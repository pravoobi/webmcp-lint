import type { HtmlRule, RawFinding, SourceLocation } from "../types.js";

export const uniqueToolnames: HtmlRule = {
  id: "unique-toolnames",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/unique-toolnames.md",
  defaultSeverity: "error",
  fixable: false,
  description: "Require tool names to be unique across all scanned pages.",
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
      for (const loc of locs) {
        const others = locs
          .filter((l) => l !== loc)
          .map((l) => `${l.file}:${l.line}`)
          .join(", ");
        out.push({
          ruleId: "unique-toolnames",
          file: loc.file,
          loc,
          confidence: "high",
          message:
            `Tool name "${name}" is registered ${locs.length} times (also at ${others}). ` +
            "Tool names must be unique across the site or agents cannot address them.",
        });
      }
    }
    return out;
  },
};
