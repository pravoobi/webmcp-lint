import { parse } from "parse5";
import type {
  HtmlFileParse,
  HtmlTool,
  HtmlToolInput,
  SourceLocation,
} from "@pravoobi/webmcp-lint-rules";

/**
 * Attribute names for the declarative WebMCP API.
 *
 * The spec surface has drifted across Chrome versions (146 Canary → origin
 * trial → stable) and polyfills differ, so we accept a couple of spellings.
 * Re-verify against Chrome's current WebMCP docs when updating.
 */
const TOOL_NAME_ATTRS = ["toolname", "tool-name", "data-tool-name"];
const TOOL_DESC_ATTRS = ["tooldescription", "tool-description", "data-tool-description"];
const AUTOSUBMIT_ATTRS = ["toolautosubmit", "tool-autosubmit", "data-tool-autosubmit"];

const NON_DATA_INPUT_TYPES = new Set(["submit", "button", "reset", "image"]);

interface P5Attr {
  name: string;
  value: string;
}
interface P5Node {
  tagName?: string;
  nodeName: string;
  attrs?: P5Attr[];
  childNodes?: P5Node[];
  sourceCodeLocation?: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
    startTag?: { startLine: number; startCol: number; endLine: number; endCol: number };
  } | null;
}

function* walk(node: P5Node): Generator<P5Node> {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
}

function getAttr(node: P5Node, name: string): string | null {
  const attr = node.attrs?.find((a) => a.name === name);
  return attr ? attr.value : null;
}

function firstAttr(node: P5Node, names: string[]): string | null {
  for (const name of names) {
    const value = getAttr(node, name);
    if (value !== null) return value;
  }
  return null;
}

function boolAttr(node: P5Node, names: string[]): boolean {
  for (const name of names) {
    const attr = node.attrs?.find((a) => a.name === name);
    if (!attr) continue;
    const v = attr.value.trim().toLowerCase();
    return !(v === "false" || v === "0" || v === "no" || v === "off");
  }
  return false;
}

function locOf(file: string, node: P5Node, prefer: "startTag" | "whole"): SourceLocation {
  const raw = node.sourceCodeLocation;
  const src = prefer === "startTag" && raw?.startTag ? raw.startTag : raw;
  return {
    file,
    line: src?.startLine ?? 1,
    column: src?.startCol ?? 1,
    endLine: src?.endLine,
    endColumn: src?.endCol,
  };
}

function isToolForm(node: P5Node): boolean {
  return (
    firstAttr(node, TOOL_NAME_ATTRS) !== null ||
    firstAttr(node, TOOL_DESC_ATTRS) !== null ||
    AUTOSUBMIT_ATTRS.some((n) => getAttr(node, n) !== null)
  );
}

function collectInputs(file: string, form: P5Node): HtmlToolInput[] {
  const inputs: HtmlToolInput[] = [];
  for (const el of walk(form)) {
    if (el === form) continue;
    const tag = el.tagName;
    if (tag !== "input" && tag !== "select" && tag !== "textarea") continue;

    const type = (getAttr(el, "type") ?? (tag === "input" ? "text" : tag)).toLowerCase();
    const name = getAttr(el, "name");
    const hidden = type === "hidden";
    const isDataControl = !(tag === "input" && NON_DATA_INPUT_TYPES.has(type));

    inputs.push({
      tag,
      name,
      id: getAttr(el, "id"),
      type,
      value: getAttr(el, "value"),
      hidden,
      inSchema: name != null && name !== "" && isDataControl,
      loc: locOf(file, el, "startTag"),
    });
  }
  return inputs;
}

/** Parse one HTML document into the declarative tools it declares. */
export function parseHtml(source: string, file: string): HtmlFileParse {
  const doc = parse(source, { sourceCodeLocationInfo: true }) as unknown as P5Node;
  const tools: HtmlTool[] = [];

  for (const node of walk(doc)) {
    if (node.tagName !== "form" || !isToolForm(node)) continue;

    tools.push({
      name: firstAttr(node, TOOL_NAME_ATTRS),
      description: firstAttr(node, TOOL_DESC_ATTRS),
      autosubmit: boolAttr(node, AUTOSUBMIT_ATTRS),
      method: (getAttr(node, "method") ?? "").toLowerCase(),
      action: getAttr(node, "action") ?? "",
      formName: getAttr(node, "name"),
      inputs: collectInputs(file, node),
      loc: locOf(file, node, "startTag"),
    });
  }

  return { file, source, tools };
}
