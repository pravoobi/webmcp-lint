import type { JsRule, RawFinding } from "../types.js";

export const toolCount: JsRule = {
  id: "tool-count",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/tool-count.md",
  defaultSeverity: "info",
  fixable: false,
  description: "Flag more than N tools registered across the scanned files (default 15).",
  check(parses, ctx) {
    const all = parses.flatMap((p) => p.toolCalls.map((t) => ({ parse: p, tool: t })));
    if (all.length <= ctx.toolCountMax) return [];

    // Static analysis can't know how scanned files compose into one running
    // page, so — same assumption `unique-toolnames` already makes — this
    // treats everything passed to one `static` invocation as one surface.
    // Point at the call site that tips the count over the threshold.
    const tipping = all[ctx.toolCountMax]!;
    const out: RawFinding[] = [
      {
        ruleId: "tool-count",
        file: tipping.parse.file,
        loc: tipping.tool.loc,
        confidence: "medium",
        message:
          `${all.length} tools are registered across the scanned files (threshold ${ctx.toolCountMax}). ` +
          "Agents degrade with large tool menus — consider splitting by page/route or grouping " +
          "related tools.",
      },
    ];
    return out;
  },
};
