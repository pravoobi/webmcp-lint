import type { RawFinding } from "../../types.js";
import type { RuntimeRule, RuntimeToolInfo } from "../types.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Whether this tool claims to be read-only. */
function isReadOnly(tool: RuntimeToolInfo): boolean {
  if (tool.annotations["readOnlyHint"] === true) return true;
  // A declarative GET form is inherently a read operation.
  if (tool.source === "declarative" && (tool.formMethod === "get" || tool.formMethod === "")) {
    return true;
  }
  return false;
}

export const noSideEffectsOnRead: RuntimeRule = {
  id: "no-side-effects-on-read",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/no-side-effects-on-read.md",
  defaultSeverity: "error",
  fixable: false,
  description:
    "Invoking a read-only tool must not fire non-GET network requests.",
  check(observations) {
    const out: RawFinding[] = [];
    for (const obs of observations) {
      if (!obs.loadOk) continue;
      const at = { file: obs.url, line: 1, column: 1 };

      for (const tool of obs.tools) {
        if (!isReadOnly(tool)) continue;
        const valid = obs.invocations.find(
          (i) => i.tool === tool.name && i.phase === "valid",
        );
        if (!valid || valid.outcome === "skipped") continue;

        const mutations = valid.network.filter(
          (n) => !SAFE_METHODS.has(n.method.toUpperCase()),
        );
        for (const m of mutations) {
          out.push({
            ruleId: "no-side-effects-on-read",
            file: obs.url,
            loc: at,
            confidence: "high",
            message:
              `Read-only tool "${tool.name}" issued ${m.method.toUpperCase()} ${m.url} ` +
              "when invoked. A tool marked readOnlyHint (or a GET form) must not mutate state.",
          });
        }
      }
    }
    return out;
  },
};
