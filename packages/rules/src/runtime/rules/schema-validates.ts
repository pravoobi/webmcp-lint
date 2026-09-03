import type { RawFinding } from "../../types.js";
import type { RuntimeObservation, RuntimeRule, ToolInvocation } from "../types.js";

function short(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

function find(
  obs: RuntimeObservation,
  tool: string,
  phase: ToolInvocation["phase"],
): ToolInvocation | undefined {
  return obs.invocations.find((i) => i.tool === tool && i.phase === phase);
}

export const schemaValidates: RuntimeRule = {
  id: "schema-validates",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/schema-validates.md",
  defaultSeverity: "warn",
  fixable: false,
  description:
    "Each tool should run cleanly on a schema-valid input and never hang.",
  check(observations) {
    const out: RawFinding[] = [];
    for (const obs of observations) {
      if (!obs.loadOk) continue;
      const at = { file: obs.url, line: 1, column: 1 };

      for (const tool of obs.tools) {
        const valid = find(obs, tool.name, "valid");
        const invalid = find(obs, tool.name, "invalid");

        if (valid?.outcome === "rejected") {
          out.push({
            ruleId: "schema-validates",
            file: obs.url,
            loc: at,
            confidence: "high",
            message:
              `Tool "${tool.name}" rejected a schema-valid input ${short(valid.input)}: ` +
              `${valid.error ?? "(no message)"}. An agent calling it correctly would fail.`,
          });
        } else if (valid?.outcome === "timeout") {
          out.push({
            ruleId: "schema-validates",
            file: obs.url,
            loc: at,
            confidence: "medium",
            message:
              `Tool "${tool.name}" did not resolve within the timeout for a valid input — ` +
              "an agent calling it would hang.",
          });
        } else if (valid?.outcome === "skipped") {
          out.push({
            ruleId: "schema-validates",
            file: obs.url,
            loc: at,
            confidence: "low",
            message:
              `Tool "${tool.name}" could not be runtime-tested (${valid.skippedReason ?? "skipped"}); ` +
              "static rules still apply.",
          });
        }

        if (invalid?.outcome === "timeout") {
          out.push({
            ruleId: "schema-validates",
            file: obs.url,
            loc: at,
            confidence: "medium",
            message:
              `Tool "${tool.name}" hung on a schema-invalid input ${short(invalid.input)} ` +
              "instead of failing fast with an error.",
          });
        }
      }
    }
    return out;
  },
};
