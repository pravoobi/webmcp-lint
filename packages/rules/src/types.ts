/**
 * Core types shared across the WebMCP lint packages.
 *
 * The `rules` package is intentionally pure: it never touches the filesystem or
 * a browser. Callers (the `static` and `runtime` packages) are responsible for
 * turning source into the parsed shapes below and feeding them to the engine.
 */

export type Severity = "error" | "warn" | "info";
export type RuleLevel = Severity | "off";
export type Confidence = "high" | "medium" | "low";

/** 1-based source position, matching most editors and parse5. */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/** A form control that a declarative WebMCP tool would (or would not) expose. */
export interface HtmlToolInput {
  /** `input` | `select` | `textarea` */
  tag: "input" | "select" | "textarea";
  name: string | null;
  id: string | null;
  /** Lowercased input type, or the tag name for select/textarea. */
  type: string;
  value: string | null;
  hidden: boolean;
  /**
   * Whether this control would appear in the generated tool input schema.
   * Hand-rolled annotations tend to include everything with a `name`; the
   * auto-webmcp generator additionally drops password/file/hidden controls.
   */
  inSchema: boolean;
  loc: SourceLocation;
}

/** A declarative tool parsed from an annotated `<form>`. */
export interface HtmlTool {
  name: string | null;
  description: string | null;
  autosubmit: boolean;
  /** Lowercased form method (`get` | `post` | `dialog` | ""), plus `_method` overrides. */
  method: string;
  action: string;
  /** The form's `name` attribute, if any. */
  formName: string | null;
  inputs: HtmlToolInput[];
  loc: SourceLocation;
}

/** Result of parsing one HTML file. */
export interface HtmlFileParse {
  file: string;
  source: string;
  tools: HtmlTool[];
}

/** One property of a `registerTool`/hook call's `inputSchema` object literal. */
export interface JsSchemaProperty {
  name: string;
  hasDescription: boolean;
  loc: SourceLocation;
}

/**
 * One imperative tool registration call site: `document.modelContext.registerTool(...)`,
 * `navigator.modelContext.registerTool(...)`, or a React-style hook whose name
 * suggests WebMCP (`useWebMCP`, `useMcpTool`, …).
 *
 * Extraction is syntactic and per-file (no cross-module resolution), so any
 * field can come back `null`/`unknown` when the call doesn't fit the common
 * "inline object literal, inline handler function" shape — rules that need a
 * field just skip a call site where it's unavailable rather than guessing.
 */
export interface JsToolCallSite {
  api: "registerTool" | "hook" | "unknown";
  /**
   * False when the first argument wasn't an inline object literal (or a
   * same-file `const x = {...}` we could resolve it to) — e.g. built by a
   * helper function, or imported. Rules that need to see the tool's shape
   * to flag an *absence* (schema-required) must check this first: an
   * unresolved call is "we don't know", not "it's missing".
   */
  argResolved: boolean;
  /** The literal `name` property value, when statically resolvable. */
  name: string | null;
  description: string | null;
  hasInputSchema: boolean;
  /** Properties of the schema's top-level `properties` object, if it's an object literal. */
  schemaProperties: JsSchemaProperty[] | null;
  annotations: {
    readOnlyHint: boolean | null;
    destructiveHint: boolean | null;
  };
  /** Source text of the `execute`/`handler` function, when inline or resolvable in-file. */
  handlerText: string | null;
  handlerLoc: SourceLocation | null;
  loc: SourceLocation;
}

/** A direct reference to `navigator.modelContext` or `document.modelContext`. */
export interface JsModelContextRef {
  surface: "navigator" | "document";
  loc: SourceLocation;
}

/** Result of parsing one JS/TS file for the imperative WebMCP API. */
export interface JsFileParse {
  file: string;
  source: string;
  toolCalls: JsToolCallSite[];
  modelContextRefs: JsModelContextRef[];
}

export interface RawFinding {
  ruleId: string;
  message: string;
  file: string;
  loc: SourceLocation;
  /** A suggested edit, shown to the user but never auto-applied by default. */
  suggestion?: string;
  confidence?: Confidence;
  /**
   * Override the rule's `defaultSeverity` for this specific finding — e.g. a
   * low-confidence heuristic branch that shouldn't be able to fail CI on its
   * own. Ignored when the user has explicitly configured this rule's level
   * in `WebmcpLintConfig.rules`; that always wins.
   */
  severity?: Severity;
}

export interface Finding extends RawFinding {
  severity: Severity;
  fixable: boolean;
  docs: string;
}

export interface RuleContext {
  /** Combined destructive-name matcher (defaults merged with user patterns). */
  destructiveRegex: RegExp;
}

export interface HtmlRule {
  id: string;
  docs: string;
  defaultSeverity: Severity;
  /** True when a mechanically safe autofix exists (e.g. mirroring `id` to `name`). */
  fixable: boolean;
  /** Short human summary, surfaced in docs and `--help`. */
  description: string;
  check(parses: HtmlFileParse[], ctx: RuleContext): RawFinding[];
}

export interface JsRuleContext extends RuleContext {
  /** `tool-count` threshold (default 15, see `WebmcpLintConfig.toolCountMax`). */
  toolCountMax: number;
}

export interface JsRule {
  id: string;
  docs: string;
  defaultSeverity: Severity;
  fixable: boolean;
  description: string;
  check(parses: JsFileParse[], ctx: JsRuleContext): RawFinding[];
}
