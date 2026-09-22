import { Project, SyntaxKind, Node, ScriptKind, ts } from "ts-morph";
import type {
  CallExpression,
  ObjectLiteralExpression,
  SourceFile,
} from "ts-morph";
import type {
  JsFileParse,
  JsModelContextRef,
  JsSchemaProperty,
  JsToolCallSite,
  SourceLocation,
} from "@pravoobi/webmcp-lint-rules";

/**
 * Hook names that suggest a WebMCP tool-registration hook, e.g. `useWebMCP`,
 * `useWebMCPTool`, `useMcpTool`. Deliberately loose (must start with "use"
 * and contain "mcp" case-insensitively) — an app not using WebMCP is very
 * unlikely to have a hook literally named with "mcp" in it.
 */
const HOOK_NAME_RE = /^use.*mcp/i;

function scriptKindFor(file: string): ScriptKind {
  if (file.endsWith(".tsx")) return ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ScriptKind.JSX;
  if (file.endsWith(".ts")) return ScriptKind.TS;
  return ScriptKind.JS;
}

function locOf(sourceFile: SourceFile, node: { getStart(): number; getEnd(): number }, file: string): SourceLocation {
  const start = sourceFile.getLineAndColumnAtPos(node.getStart());
  const end = sourceFile.getLineAndColumnAtPos(node.getEnd());
  return { file, line: start.line, column: start.column, endLine: end.line, endColumn: end.column };
}

function stringLiteralValue(node: Node | undefined): string | null {
  if (!node) return null;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return null;
}

function boolLiteralValue(node: Node | undefined): boolean | null {
  if (!node) return null;
  if (node.getKind() === SyntaxKind.TrueKeyword) return true;
  if (node.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
}

function propInit(obj: ObjectLiteralExpression, name: string): Node | undefined {
  const prop = obj.getProperty(name);
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined;
  return prop.getInitializer();
}

/** Resolve an identifier to a same-file `const x = {...}` object literal, if any. */
function resolveObjectLiteral(sourceFile: SourceFile, node: Node | undefined): ObjectLiteralExpression | null {
  if (!node) return null;
  if (Node.isObjectLiteralExpression(node)) return node;
  if (Node.isIdentifier(node)) {
    const decl = sourceFile.getVariableDeclaration(node.getText());
    const init = decl?.getInitializer();
    if (init && Node.isObjectLiteralExpression(init)) return init;
  }
  return null;
}

/** Resolve an identifier to a same-file function/arrow-function value's text + location. */
function resolveHandler(
  sourceFile: SourceFile,
  file: string,
  node: Node | undefined,
): { text: string; loc: SourceLocation } | null {
  if (!node) return null;
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return { text: node.getText(), loc: locOf(sourceFile, node, file) };
  }
  if (Node.isIdentifier(node)) {
    const name = node.getText();
    const fn = sourceFile.getFunction(name);
    if (fn) return { text: fn.getText(), loc: locOf(sourceFile, fn, file) };
    const decl = sourceFile.getVariableDeclaration(name);
    const init = decl?.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      return { text: init.getText(), loc: locOf(sourceFile, init, file) };
    }
  }
  return null;
}

function readSchemaProperties(
  sourceFile: SourceFile,
  file: string,
  schema: Node | undefined,
): JsSchemaProperty[] | null {
  const schemaObj = schema && Node.isObjectLiteralExpression(schema) ? schema : null;
  if (!schemaObj) return null;
  const propsInit = propInit(schemaObj, "properties");
  if (!propsInit || !Node.isObjectLiteralExpression(propsInit)) return null;

  const out: JsSchemaProperty[] = [];
  for (const prop of propsInit.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getName();
    const value = prop.getInitializer();
    const hasDescription =
      value != null && Node.isObjectLiteralExpression(value) && value.getProperty("description") != null;
    out.push({ name, hasDescription, loc: locOf(sourceFile, prop, file) });
  }
  return out;
}

function extractCallSite(
  sourceFile: SourceFile,
  file: string,
  call: CallExpression,
  api: "registerTool" | "hook",
): JsToolCallSite {
  const loc = locOf(sourceFile, call, file);
  const argObj = resolveObjectLiteral(sourceFile, call.getArguments()[0]);

  if (!argObj) {
    return {
      api,
      argResolved: false,
      name: null,
      description: null,
      hasInputSchema: false,
      schemaProperties: null,
      annotations: { readOnlyHint: null, destructiveHint: null },
      handlerText: null,
      handlerLoc: null,
      loc,
    };
  }

  const schemaInit = propInit(argObj, "inputSchema");
  const annotationsObj = propInit(argObj, "annotations");
  const annotations =
    annotationsObj && Node.isObjectLiteralExpression(annotationsObj)
      ? {
          readOnlyHint: boolLiteralValue(propInit(annotationsObj, "readOnlyHint")),
          destructiveHint: boolLiteralValue(propInit(annotationsObj, "destructiveHint")),
        }
      : { readOnlyHint: null, destructiveHint: null };

  const handlerNode = propInit(argObj, "execute") ?? propInit(argObj, "handler");
  const handler = resolveHandler(sourceFile, file, handlerNode);

  return {
    api,
    argResolved: true,
    name: stringLiteralValue(propInit(argObj, "name")),
    description: stringLiteralValue(propInit(argObj, "description")),
    hasInputSchema: schemaInit != null,
    schemaProperties: readSchemaProperties(sourceFile, file, schemaInit),
    annotations,
    handlerText: handler?.text ?? null,
    handlerLoc: handler?.loc ?? null,
    loc,
  };
}

function collectModelContextRefs(sourceFile: SourceFile, file: string): JsModelContextRef[] {
  const out: JsModelContextRef[] = [];
  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (node.getName() !== "modelContext") continue;
    const obj = node.getExpression();
    if (!Node.isIdentifier(obj)) continue;
    const text = obj.getText();
    if (text !== "navigator" && text !== "document") continue;
    out.push({ surface: text, loc: locOf(sourceFile, node, file) });
  }
  return out;
}

/** Parse one JS/TS source for the imperative WebMCP API (no cross-file resolution). */
export function parseJs(source: string, file: string): JsFileParse {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.ReactJSX },
  });
  const sourceFile = project.createSourceFile(file, source, { scriptKind: scriptKindFor(file) });

  const toolCalls: JsToolCallSite[] = [];
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();

    if (Node.isPropertyAccessExpression(callee) && callee.getName() === "registerTool") {
      toolCalls.push(extractCallSite(sourceFile, file, call, "registerTool"));
      continue;
    }
    if (Node.isIdentifier(callee) && HOOK_NAME_RE.test(callee.getText())) {
      toolCalls.push(extractCallSite(sourceFile, file, call, "hook"));
    }
  }

  return { file, source, toolCalls, modelContextRefs: collectModelContextRefs(sourceFile, file) };
}
