import type { HtmlRule, RawFinding, SourceLocation } from "../types.js";

export const uniqueToolnames: HtmlRule = {
  id: "unique-toolnames",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/unique-toolnames.md",
  defaultSeverity: "error",
  fixable: false,
  description: "Require tool names to be unique within a page, and flag reuse across pages.",
  check(parses) {
    const byName = new Map<string, SourceLocation[]>();
    for (const parse of parses) {
      for (const tool of parse.tools) {
        if (!tool.name) continue;
        const list = byName.get(tool.name) ?? [];
        list.push(tool.loc);
        byName.set(tool.name, list);
      }
    }

    const out: RawFinding[] = [];
    for (const [name, locs] of byName) {
      if (locs.length < 2) continue;

      // Two registrations of the same name in one *file* is an unambiguous
      // bug — that document's modelContext can only hold one. Reuse across
      // *different* files is only a bug if an agent could ever see both at
      // once (an iframe, an SPA route swap); on ordinary distinct pages the
      // same name is fine, since WebMCP tools are scoped to the page loaded.
      // We can't tell those apart from static HTML alone, so treat
      // same-file collisions as certain (`error`) and cross-file reuse as a
      // heads-up (`warn`).
      const sameFile = new Set(locs.map((l) => l.file)).size < locs.length;

      for (const loc of locs) {
        const others = locs
          .filter((l) => l !== loc)
          .map((l) => `${l.file}:${l.line}`)
          .join(", ");
        out.push({
          ruleId: "unique-toolnames",
          file: loc.file,
          loc,
          confidence: sameFile ? "high" : "medium",
          ...(sameFile
            ? {}
            : { severity: "warn" as const }),
          message: sameFile
            ? `Tool name "${name}" is registered ${locs.length} times (also at ${others}), ` +
              "including twice in the same page. A page's modelContext can only hold one " +
              "tool per name — the later registration will fail or silently win."
            : `Tool name "${name}" is also used at ${others}. If an agent could ever have ` +
              "both pages' tools in scope at once (an iframe, an SPA route swap) it can't " +
              "tell them apart; if these are separate pages a user navigates between, this is fine.",
        });
      }
    }
    return out;
  },
};
