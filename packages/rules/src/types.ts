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

export interface RawFinding {
  ruleId: string;
  message: string;
  file: string;
  loc: SourceLocation;
  /** A suggested edit, shown to the user but never auto-applied by default. */
  suggestion?: string;
  confidence?: Confidence;
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
