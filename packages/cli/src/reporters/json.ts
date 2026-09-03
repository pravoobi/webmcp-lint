import { displayPath, type ReportInput } from "../report.js";

export function renderJson(input: ReportInput): string {
  return JSON.stringify(
    {
      version: 1,
      summary: {
        ...input.summary,
        errors: input.errors,
        warnings: input.warnings,
        infos: input.infos,
      },
      findings: input.findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
        file: f.file,
        path: displayPath(f.file, input.cwd),
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
