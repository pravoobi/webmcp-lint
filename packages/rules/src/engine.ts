import type { WebmcpLintConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import { htmlRules } from "./rules/index.js";
import type { Finding, HtmlFileParse, HtmlRule } from "./types.js";

export interface RunOptions {
  config?: WebmcpLintConfig;
  /** Restrict the run to a subset of rules (by id). Defaults to all. */
  rules?: HtmlRule[];
}

function compareFindings(a: Finding, b: Finding): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.loc.line !== b.loc.line) return a.loc.line - b.loc.line;
  if (a.loc.column !== b.loc.column) return a.loc.column - b.loc.column;
  return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
}

export function runHtmlRules(
  parses: HtmlFileParse[],
  options: RunOptions = {},
): Finding[] {
  const resolved = resolveConfig(options.config);
  const active = options.rules ?? htmlRules;
  const ctx = { destructiveRegex: resolved.destructiveRegex };

  const findings: Finding[] = [];
  for (const rule of active) {
    const configured = resolved.rules[rule.id];
    if (configured === "off") continue;

    for (const raw of rule.check(parses, ctx)) {
      findings.push({
        ...raw,
        // An explicit user override always wins; otherwise let the rule
        // downgrade an individual low-confidence finding, else its default.
        severity: configured ?? raw.severity ?? rule.defaultSeverity,
        fixable: rule.fixable,
        docs: rule.docs,
      });
    }
  }

  return findings.sort(compareFindings);
}

export interface FindingCounts {
  error: number;
  warn: number;
  info: number;
}

export function countBySeverity(findings: Finding[]): FindingCounts {
  const counts: FindingCounts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}
