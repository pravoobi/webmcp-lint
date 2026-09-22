import type { WebmcpLintConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import { jsRules } from "./rules-js/index.js";
import type { Finding, JsFileParse, JsRule } from "./types.js";

export interface RunJsOptions {
  config?: WebmcpLintConfig;
  /** Restrict the run to a subset of rules (by id). Defaults to all. */
  rules?: JsRule[];
}

function compareFindings(a: Finding, b: Finding): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.loc.line !== b.loc.line) return a.loc.line - b.loc.line;
  if (a.loc.column !== b.loc.column) return a.loc.column - b.loc.column;
  return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
}

export function runJsRules(parses: JsFileParse[], options: RunJsOptions = {}): Finding[] {
  const resolved = resolveConfig(options.config);
  const active = options.rules ?? jsRules;
  const ctx = { destructiveRegex: resolved.destructiveRegex, toolCountMax: resolved.toolCountMax };

  const findings: Finding[] = [];
  for (const rule of active) {
    const configured = resolved.rules[rule.id];
    if (configured === "off") continue;

    for (const raw of rule.check(parses, ctx)) {
      findings.push({
        ...raw,
        severity: configured ?? raw.severity ?? rule.defaultSeverity,
        fixable: rule.fixable,
        docs: rule.docs,
      });
    }
  }

  return findings.sort(compareFindings);
}
