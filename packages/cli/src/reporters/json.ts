import type { Finding } from "@webmcp-lint/rules";

export function renderJson(
  findings: Finding[],
  summary: Record<string, number>,
): string {
  return JSON.stringify(
    {
      version: 1,
      summary,
      findings: findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
        file: f.file,
        line: f.loc.line,
        column: f.loc.column,
        endLine: f.loc.endLine ?? null,
        endColumn: f.loc.endColumn ?? null,
        confidence: f.confidence ?? null,
        fixable: f.fixable,
        suggestion: f.suggestion ?? null,
        docs: f.docs,
      })),
    },
    null,
    2,
  );
}
