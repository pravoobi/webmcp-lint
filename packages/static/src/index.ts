import { readFile } from "node:fs/promises";
import {
  countBySeverity,
  runHtmlRules,
  runJsRules,
  type Finding,
  type HtmlFileParse,
  type JsFileParse,
  type WebmcpLintConfig,
} from "@pravoobi/webmcp-lint-rules";
import { parseHtml } from "./html/parse.js";
import { parseJs } from "./js/parse.js";

export { parseHtml } from "./html/parse.js";
export { parseJs } from "./js/parse.js";

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

function summarize(files: number, tools: number, findings: Finding[]): StaticResult {
  const counts = countBySeverity(findings);
  return {
    findings,
    stats: { files, tools, errors: counts.error, warnings: counts.warn, infos: counts.info },
  };
}

/** Analyze already-loaded HTML sources. Handy for tests and in-memory use. */
export function analyzeHtmlSources(
  sources: { file: string; source: string }[],
  config?: WebmcpLintConfig,
): StaticResult {
  const parses = sources.map((s) => parseHtml(s.source, s.file));
  return summarize(
    parses.length,
    parses.reduce((n, p) => n + p.tools.length, 0),
    runHtmlRules(parses, { config }),
  );
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
  return summarize(
    parses.length,
    parses.reduce((n, p) => n + p.tools.length, 0),
    runHtmlRules(parses, { config }),
  );
}

/** Analyze already-loaded JS/TS sources (imperative `registerTool`/hook API). */
export function analyzeJsSources(
  sources: { file: string; source: string }[],
  config?: WebmcpLintConfig,
): StaticResult {
  const parses = sources.map((s) => parseJs(s.source, s.file));
  return summarize(
    parses.length,
    parses.reduce((n, p) => n + p.toolCalls.length, 0),
    runJsRules(parses, { config }),
  );
}

/** Read and analyze JS/TS files from disk. */
export async function analyzeJsFiles(
  files: string[],
  config?: WebmcpLintConfig,
): Promise<StaticResult> {
  const parses: JsFileParse[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    parses.push(parseJs(source, file));
  }
  return summarize(
    parses.length,
    parses.reduce((n, p) => n + p.toolCalls.length, 0),
    runJsRules(parses, { config }),
  );
}

const HTML_EXT_RE = /\.html?$/i;
const JS_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;

function compareFindings(a: Finding, b: Finding): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.loc.line !== b.loc.line) return a.loc.line - b.loc.line;
  return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
}

/**
 * Read and analyze a mixed set of files from disk — HTML runs the
 * declarative rules, JS/TS (by extension) runs the imperative ones — and
 * merges the results into one report. This is what `webmcp-lint static`
 * uses; call `analyzeHtmlFiles`/`analyzeJsFiles` directly if you already
 * know which kind you have.
 */
export async function analyzeStaticFiles(
  files: string[],
  config?: WebmcpLintConfig,
): Promise<StaticResult> {
  const htmlFiles = files.filter((f) => HTML_EXT_RE.test(f));
  const jsFiles = files.filter((f) => JS_EXT_RE.test(f));

  const [html, js] = await Promise.all([
    htmlFiles.length > 0 ? analyzeHtmlFiles(htmlFiles, config) : null,
    jsFiles.length > 0 ? analyzeJsFiles(jsFiles, config) : null,
  ]);

  const parts = [html, js].filter((r): r is StaticResult => r != null);
  return {
    findings: parts.flatMap((r) => r.findings).sort(compareFindings),
    stats: {
      files: parts.reduce((n, r) => n + r.stats.files, 0),
      tools: parts.reduce((n, r) => n + r.stats.tools, 0),
      errors: parts.reduce((n, r) => n + r.stats.errors, 0),
      warnings: parts.reduce((n, r) => n + r.stats.warnings, 0),
      infos: parts.reduce((n, r) => n + r.stats.infos, 0),
    },
  };
}
