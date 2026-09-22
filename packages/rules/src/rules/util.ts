import type { HtmlTool } from "../types.js";

export function toolLabel(tool: HtmlTool): string {
  return tool.name ? `"${tool.name}"` : "(unnamed tool)";
}

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

/** True when the form's method (including `_method` overrides) implies a mutation. */
export function isMutatingMethod(tool: HtmlTool): boolean {
  if (MUTATING_METHODS.has(tool.method)) return true;
  const override = tool.inputs.find(
    (i) => i.name != null && /^_?method$/i.test(i.name) && i.value != null,
  );
  return override != null && MUTATING_METHODS.has(override.value!.toLowerCase());
}

export function normalizeDescription(desc: string | null): string {
  return (desc ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Read/query verbs that make an otherwise destructive-looking name a lookup,
 * not a mutation — e.g. `get_order_status` matches the destructive noun
 * "order" but is plainly a read. Used to soften name-only heuristics; a real
 * mutating HTTP method is unaffected by this and still always flags.
 */
const READ_VERB_RE = /\b(get|view|list|search|check|lookup|fetch|query|find|show|track|status|history)\b/i;

export function looksReadOnly(haystack: string): boolean {
  return READ_VERB_RE.test(haystack);
}
