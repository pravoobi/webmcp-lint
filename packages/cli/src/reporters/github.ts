import { appendFileSync } from "node:fs";
import type { Finding } from "@pravoobi/webmcp-lint-rules";
import { displayPath, ghCommand, type ReportInput } from "../report.js";

function escData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escProp(s: string): string {
  return escData(s).replace(/,/g, "%2C").replace(/:/g, "%3A");
}

function annotation(f: Finding, cwd: string): string {
  const path = displayPath(f.file, cwd);
  const props = [
    `file=${escProp(path)}`,
    `line=${f.loc.line}`,
    `col=${f.loc.column}`,
    ...(f.loc.endLine ? [`endLine=${f.loc.endLine}`] : []),
    `title=${escProp(`webmcp-lint/${f.ruleId}`)}`,
  ].join(",");
  const body = f.suggestion ? `${f.message}\nSuggested fix: ${f.suggestion}` : f.message;
  return `::${ghCommand(f.severity)} ${props}::${escData(body)}`;
}

function summaryTable(input: ReportInput): string {
  const rows = new Map<string, { error: number; warn: number; info: number }>();
  for (const f of input.findings) {
    const r = rows.get(f.ruleId) ?? { error: 0, warn: 0, info: 0 };
    r[f.severity]++;
    rows.set(f.ruleId, r);
  }

  const lines: string[] = [];
  lines.push("## webmcp-lint");
  lines.push("");
  const scopeParts = Object.entries(input.summary)
    .filter(([k]) => !["errors", "warnings", "infos"].includes(k))
    .map(([k, v]) => `**${v}** ${k}`);
  lines.push(scopeParts.join(" · ") || input.scope);
  lines.push("");
  lines.push(
    `**${input.errors}** error(s) · **${input.warnings}** warning(s) · **${input.infos}** info`,
  );
  lines.push("");

  if (rows.size > 0) {
    lines.push("| Rule | Errors | Warnings | Info |");
    lines.push("| --- | --: | --: | --: |");
    for (const [id, r] of [...rows].sort()) {
      lines.push(`| \`${id}\` | ${r.error || ""} | ${r.warn || ""} | ${r.info || ""} |`);
    }
  } else {
    lines.push("✅ No problems found.");
  }
  lines.push("");
  return lines.join("\n");
}

export function renderGithub(input: ReportInput): string {
  const table = summaryTable(input);

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, table + "\n");
    } catch {
      /* non-fatal */
    }
  }

  const annotations = input.findings.map((f) => annotation(f, input.cwd));
  return annotations.length > 0 ? `${annotations.join("\n")}\n\n${table}` : table;
}
