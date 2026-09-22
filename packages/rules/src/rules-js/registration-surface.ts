import type { JsRule, RawFinding } from "../types.js";

export const registrationSurface: JsRule = {
  id: "registration-surface",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/registration-surface.md",
  defaultSeverity: "warn",
  fixable: false,
  description:
    "Flag hardcoding `navigator.modelContext` or `document.modelContext` without feature-detecting both.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      if (parse.modelContextRefs.length === 0) continue;
      const surfaces = new Set(parse.modelContextRefs.map((r) => r.surface));
      // If the file references *both* surfaces anywhere, assume it's doing
      // its own feature-detection/compat shim somewhere and don't flag —
      // pinning down that a specific reference is "the" fallback check would
      // need real data-flow analysis; this file-level signal is conservative.
      if (surfaces.size > 1) continue;

      const only = [...surfaces][0]!;
      const other = only === "navigator" ? "document" : "navigator";
      for (const ref of parse.modelContextRefs) {
        out.push({
          ruleId: "registration-surface",
          file: parse.file,
          loc: ref.loc,
          confidence: "medium",
          message:
            `Only \`${only}.modelContext\` is referenced in this file — never \`${other}.modelContext\`. ` +
            "The WebMCP surface has moved before and polyfills differ on which they expose; " +
            "feature-detect both rather than hardcoding one.",
          suggestion: `Use \`${only}.modelContext ?? ${other}.modelContext\` (or check both explicitly).`,
        });
      }
    }
    return out;
  },
};
