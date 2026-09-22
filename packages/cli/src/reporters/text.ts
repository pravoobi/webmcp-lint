import type { Finding } from "@pravoobi/webmcp-lint-rules";
import { displayPath, type ReportInput } from "../report.js";

const COLOR = process.stdout.isTTY && !process.env["NO_COLOR"];

const c = {
  dim: (s: string) => (COLOR ? `\x1b[2m${s}\x1b[0m` : s),
  red: (s: string) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (COLOR ? `\x1b[33m${s}\x1b[0m` : s),
  blue: (s: string) => (COLOR ? `\x1b[34m${s}\x1b[0m` : s),
  bold: (s: string) => (COLOR ? `\x1b[1m${s}\x1b[0m` : s),
};

function severityTag(sev: Finding["severity"]): string {
  if (sev === "error") return c.red("error");
  if (sev === "warn") return c.yellow("warn ");
  return c.blue("info ");
}

export function renderText(report: ReportInput): string {
  const { findings, cwd } = report;
  const lines: string[] = [];

  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  for (const [file, fileFindings] of byFile) {
    lines.push(c.bold(displayPath(file, cwd)));
    for (const f of fileFindings) {
      const pos = c.dim(`${f.loc.line}:${f.loc.column}`);
      lines.push(`  ${pos}  ${severityTag(f.severity)}  ${f.message}  ${c.dim(f.ruleId)}`);
      if (f.suggestion) lines.push(`        ${c.dim("↳ " + f.suggestion)}`);
    }
    lines.push("");
  }

  const problems = report.errors + report.warnings + report.infos;
  if (problems === 0) {
    lines.push(c.dim(`✓ no problems — ${report.scope}`));
  } else {
    const parts = [
      `${report.errors} error(s)`,
      `${report.warnings} warning(s)`,
      `${report.infos} info`,
    ];
    const mark = report.errors > 0 ? c.red("✖") : c.yellow("!");
    lines.push(`${mark} ${problems} problem(s) — ${parts.join(", ")}  ${c.dim(`(${report.scope})`)}`);
  }

  return lines.join("\n");
}
