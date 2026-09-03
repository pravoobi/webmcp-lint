import { readFile } from "node:fs/promises";
import {
  countBySeverity,
  runHtmlRules,
  type Finding,
  type HtmlFileParse,
  type WebmcpLintConfig,
} from "@webmcp-lint/rules";
import { parseHtml } from "./html/parse.js";

export { parseHtml } from "./html/parse.js";

export interface StaticResult {
  findings: Finding[];
  stats: {
    files: number;
    tools: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

function summarize(parses: HtmlFileParse[], findings: Finding[]): StaticResult {
  const counts = countBySeverity(findings);
  return {
    findings,
    stats: {
      files: parses.length,
      tools: parses.reduce((n, p) => n + p.tools.length, 0),
      errors: counts.error,
      warnings: counts.warn,
      infos: counts.info,
    },
  };
}

/** Analyze already-loaded HTML sources. Handy for tests and in-memory use. */
export function analyzeHtmlSources(
  sources: { file: string; source: string }[],
  config?: WebmcpLintConfig,
): StaticResult {
  const parses = sources.map((s) => parseHtml(s.source, s.file));
  return summarize(parses, runHtmlRules(parses, { config }));
}

/** Read and analyze HTML files from disk. */
export async function analyzeHtmlFiles(
  files: string[],
  config?: WebmcpLintConfig,
): Promise<StaticResult> {
  const parses: HtmlFileParse[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    parses.push(parseHtml(source, file));
  }
  return summarize(parses, runHtmlRules(parses, { config }));
}
