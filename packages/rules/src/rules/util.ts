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
