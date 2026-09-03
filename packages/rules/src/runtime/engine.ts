import type { WebmcpLintConfig } from "../config.js";
import { resolveConfig } from "../config.js";
import type { Finding } from "../types.js";
import { runtimeRules } from "./rules/index.js";
import type { RuntimeObservation, RuntimeRule } from "./types.js";

export interface RunRuntimeOptions {
  config?: WebmcpLintConfig;
  rules?: RuntimeRule[];
}

function compareFindings(a: Finding, b: Finding): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.loc.line !== b.loc.line) return a.loc.line - b.loc.line;
  return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
}

export function runRuntimeRules(
  observations: RuntimeObservation[],
  options: RunRuntimeOptions = {},
): Finding[] {
  const resolved = resolveConfig(options.config);
  const active = options.rules ?? runtimeRules;

  const findings: Finding[] = [];
  for (const rule of active) {
    const level = resolved.rules[rule.id] ?? rule.defaultSeverity;
    if (level === "off") continue;
    for (const raw of rule.check(observations, {})) {
      findings.push({ ...raw, severity: level, fixable: rule.fixable, docs: rule.docs });
    }
  }
  return findings.sort(compareFindings);
}
