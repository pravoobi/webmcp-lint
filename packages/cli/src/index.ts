#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { glob } from "tinyglobby";
import { analyzeHtmlFiles, type StaticResult } from "@webmcp-lint/static";
import { ruleCatalog, type Finding } from "@webmcp-lint/rules";
import { loadConfig } from "./config.js";
import { REPORT_FORMATS, type ReportFormat, type ReportInput } from "./report.js";
import { render } from "./reporters/index.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const DEFAULT_GLOBS = ["**/*.html", "**/*.htm"];
const DEFAULT_IGNORE = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"];

const HELP = `webmcp-lint ${pkg.version}

Usage:
  webmcp-lint static [globs...]        HTML static rules (no browser)
  webmcp-lint runtime [--url <u>...]   Load pages w/ the WebMCP polyfill, inspect + invoke tools
  webmcp-lint ci [globs...]            static + runtime together, for CI
  webmcp-lint rules                    List built-in rules

Options:
  -f, --format <text|json|sarif|github>  Output format (default: text)
  -c, --config <path>                    webmcp-lint.config.{ts,js,mjs,json}
  -o, --output <file>                    Write the report to a file instead of stdout
      --sarif-output <file>              Also write SARIF to <file> (for code-scanning upload)

runtime / ci options:
      --url <url>                        Page to check (repeatable)
      --dir <path>                       Serve this dir on localhost and check it
      --routes <file.json>               JSON array of extra paths to visit per origin
      --headed                           Show the browser
      --timeout <ms>                     Navigation / invocation timeout (default 15000)
      --no-runtime                       (ci) skip the runtime pass

      --version                          Print version
  -h, --help                             Show this help

Exit codes: 0 = clean, 1 = error-level findings, 2 = usage error
`;

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: "string", short: "f", default: "text" },
      config: { type: "string", short: "c" },
      output: { type: "string", short: "o" },
      "sarif-output": { type: "string" },
      url: { type: "string", multiple: true },
      dir: { type: "string" },
      routes: { type: "string" },
      headed: { type: "boolean", default: false },
      timeout: { type: "string" },
      "no-runtime": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", default: false },
    },
  });
}

type Values = ReturnType<typeof parse>["values"];
type Config = Awaited<ReturnType<typeof loadConfig>>["config"];

function countBy(findings: Finding[]) {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const f of findings) {
    if (f.severity === "error") errors++;
    else if (f.severity === "warn") warnings++;
    else infos++;
  }
  return { errors, warnings, infos };
}

async function writeReport(file: string, body: string, label: string): Promise<void> {
  const abs = resolve(process.cwd(), file);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body.endsWith("\n") ? body : body + "\n");
  process.stderr.write(`wrote ${label} report to ${file}\n`);
}

async function output(
  format: ReportFormat,
  input: ReportInput,
  file: string | undefined,
  sarifFile: string | undefined,
): Promise<void> {
  const text = render(format, input);
  if (file) await writeReport(file, text, format);
  else process.stdout.write(text + "\n");

  if (sarifFile && format !== "sarif") {
    await writeReport(sarifFile, render("sarif", input), "sarif");
  } else if (sarifFile && file !== sarifFile) {
    await writeReport(sarifFile, text, "sarif");
  }
}

async function main(argv: string[]): Promise<number> {
  let values: Values;
  let positionals: string[];
  try {
    ({ values, positionals } = parse(argv));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  if (values.version) {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  const command = positionals[0];
  if (!command || command === "help" || values.help) {
    process.stdout.write(HELP);
    return !command || command === "help" ? 0 : 2;
  }

  const format = values.format as ReportFormat;
  if (!REPORT_FORMATS.includes(format)) {
    process.stderr.write(`Invalid --format: ${format} (expected ${REPORT_FORMATS.join("|")})\n`);
    return 2;
  }

  if (command === "rules") {
    for (const rule of ruleCatalog) {
      process.stdout.write(
        `${rule.id.padEnd(28)} ${rule.kind.padEnd(9)} ${rule.defaultSeverity.padEnd(6)} ${rule.description}\n`,
      );
    }
    return 0;
  }

  const cwd = process.cwd();
  const { config } = await loadConfig(cwd, values.config);

  if (command === "static") {
    return runStatic(positionals.slice(1), config, cwd, format, values.output, values["sarif-output"]);
  }
  if (command === "runtime") {
    return runRuntimeCmd(values, config, cwd, format, values.output, values["sarif-output"]);
  }
  if (command === "ci") {
    return runCi(values, positionals.slice(1), config, cwd, format, values.output, values["sarif-output"]);
  }

  process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
  return 2;
}

async function collectStatic(
  globs: string[],
  config: Config,
  cwd: string,
): Promise<StaticResult | { error: string }> {
  const patterns =
    globs.length > 0
      ? globs
      : config.pages && config.pages.length > 0
        ? config.pages
        : DEFAULT_GLOBS;
  const files = await glob(patterns, { cwd, absolute: true, ignore: DEFAULT_IGNORE, dot: false });
  if (files.length === 0) return { error: `No HTML files matched: ${patterns.join(", ")}` };
  return analyzeHtmlFiles(files.sort(), config);
}

async function runStatic(
  globs: string[],
  config: Config,
  cwd: string,
  format: ReportFormat,
  outFile: string | undefined,
  sarifFile: string | undefined,
): Promise<number> {
  const result = await collectStatic(globs, config, cwd);
  if ("error" in result) {
    process.stderr.write(result.error + "\n");
    return 2;
  }
  const counts = countBy(result.findings);
  await output(
    format,
    {
      findings: result.findings,
      summary: { files: result.stats.files, tools: result.stats.tools },
      scope: `${result.stats.files} file(s), ${result.stats.tools} tool(s) checked`,
      ...counts,
      cwd,
      version: pkg.version,
    },
    outFile,
    sarifFile,
  );
  return counts.errors > 0 ? 1 : 0;
}

async function loadRoutes(cwd: string, file: string): Promise<string[]> {
  return JSON.parse(await readFile(resolve(cwd, file), "utf8")) as string[];
}

type RuntimeMod = typeof import("@webmcp-lint/runtime");

async function importRuntime(): Promise<RuntimeMod | null> {
  try {
    return await import("@webmcp-lint/runtime");
  } catch {
    return null;
  }
}

function runtimeOptions(values: Values, cwd: string, config: Config, routes: string[] | undefined) {
  return {
    urls: values.url ?? [],
    ...(values.dir ? { serveDir: resolve(cwd, values.dir), pathBase: cwd } : {}),
    ...(routes ? { routes } : {}),
    headless: !values.headed,
    ...(values.timeout ? { timeoutMs: Number(values.timeout) } : {}),
    config,
  };
}

async function runRuntimeCmd(
  values: Values,
  config: Config,
  cwd: string,
  format: ReportFormat,
  outFile: string | undefined,
  sarifFile: string | undefined,
): Promise<number> {
  if ((values.url ?? []).length === 0 && !values.dir) {
    process.stderr.write("runtime: pass --url <url> (repeatable) or --dir <path>\n");
    return 2;
  }

  let routes: string[] | undefined;
  if (values.routes) {
    try {
      routes = await loadRoutes(cwd, values.routes);
    } catch (err) {
      process.stderr.write(`runtime: could not read --routes file: ${String(err)}\n`);
      return 2;
    }
  }

  const mod = await importRuntime();
  if (!mod) {
    process.stderr.write(
      "runtime: @webmcp-lint/runtime is not installed.\n" +
        "  npm i -D @webmcp-lint/runtime && npx playwright install chromium\n",
    );
    return 2;
  }

  let result;
  try {
    result = await mod.runRuntime(runtimeOptions(values, cwd, config, routes));
  } catch (err) {
    return runtimeError(err);
  }

  const counts = countBy(result.findings);
  await output(
    format,
    {
      findings: result.findings,
      summary: { pages: result.stats.pages, tools: result.stats.tools },
      scope: `${result.stats.pages} page(s), ${result.stats.tools} tool(s) invoked`,
      ...counts,
      cwd,
      version: pkg.version,
    },
    outFile,
    sarifFile,
  );
  return counts.errors > 0 ? 1 : 0;
}

async function runCi(
  values: Values,
  globs: string[],
  config: Config,
  cwd: string,
  format: ReportFormat,
  outFile: string | undefined,
  sarifFile: string | undefined,
): Promise<number> {
  const findings: Finding[] = [];
  const summary: Record<string, number> = {};
  const scopeParts: string[] = [];

  const staticResult = await collectStatic(globs, config, cwd);
  if ("error" in staticResult) {
    if (!values.url?.length && !values.dir) {
      process.stderr.write(staticResult.error + "\n");
      return 2;
    }
  } else {
    findings.push(...staticResult.findings);
    summary["files"] = staticResult.stats.files;
    summary["staticTools"] = staticResult.stats.tools;
    scopeParts.push(`${staticResult.stats.files} file(s)`);
  }

  const wantRuntime = !values["no-runtime"] && ((values.url ?? []).length > 0 || Boolean(values.dir));
  if (wantRuntime) {
    let routes: string[] | undefined;
    if (values.routes) {
      try {
        routes = await loadRoutes(cwd, values.routes);
      } catch (err) {
        process.stderr.write(`ci: could not read --routes file: ${String(err)}\n`);
        return 2;
      }
    }
    const mod = await importRuntime();
    if (!mod) {
      process.stderr.write("ci: @webmcp-lint/runtime not installed; run with --no-runtime or install it.\n");
      return 2;
    }
    try {
      const result = await mod.runRuntime(runtimeOptions(values, cwd, config, routes));
      findings.push(...result.findings);
      summary["pages"] = result.stats.pages;
      summary["runtimeTools"] = result.stats.tools;
      scopeParts.push(`${result.stats.pages} page(s)`);
    } catch (err) {
      return runtimeError(err);
    }
  } else if (!values["no-runtime"]) {
    process.stderr.write("ci: no --url/--dir given, running static only (pass --no-runtime to silence)\n");
  }

  findings.sort((a, b) =>
    a.file !== b.file
      ? a.file < b.file
        ? -1
        : 1
      : a.loc.line - b.loc.line || (a.ruleId < b.ruleId ? -1 : 1),
  );

  const counts = countBy(findings);
  await output(
    format,
    {
      findings,
      summary,
      scope: scopeParts.join(", ") || "nothing checked",
      ...counts,
      cwd,
      version: pkg.version,
    },
    outFile,
    sarifFile,
  );
  return counts.errors > 0 ? 1 : 0;
}

function runtimeError(err: unknown): number {
  const msg = String(err);
  if (/Executable doesn't exist|Looks like Playwright|playwright install/i.test(msg)) {
    process.stderr.write("runtime: no browser found. Run:  npx playwright install chromium\n");
  } else {
    process.stderr.write(`runtime: ${msg}\n`);
  }
  return 2;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`webmcp-lint: ${(err as Error).stack ?? err}\n`);
    process.exit(2);
  });
