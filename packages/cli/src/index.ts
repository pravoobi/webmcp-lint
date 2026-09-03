#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { glob } from "tinyglobby";
import { analyzeHtmlFiles } from "@webmcp-lint/static";
import { htmlRules, runtimeRules, type Finding } from "@webmcp-lint/rules";
import { loadConfig } from "./config.js";
import { renderText } from "./reporters/text.js";
import { renderJson } from "./reporters/json.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const DEFAULT_GLOBS = ["**/*.html", "**/*.htm"];
const DEFAULT_IGNORE = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"];

const HELP = `webmcp-lint ${pkg.version}

Usage:
  webmcp-lint static [globs...]        Run HTML static rules (no browser)
  webmcp-lint runtime [--url <u>...]   Load pages with the WebMCP polyfill and inspect what registers
  webmcp-lint rules                    List built-in rules
  webmcp-lint ci                       (M3) static + runtime, SARIF + exit codes — not yet implemented

Options:
  -f, --format <text|json>            Output format (default: text)
  -c, --config <path>                 Path to webmcp-lint.config.{ts,js,mjs,json}

runtime options:
      --url <url>                     Page to check (repeatable)
      --dir <path>                    Serve this directory on localhost and check it
      --routes <file.json>            JSON array of extra paths to visit per origin
      --headed                        Show the browser (default: headless)
      --timeout <ms>                  Navigation / invocation timeout (default: 15000)

      --version                       Print version
  -h, --help                          Show this help

Exit codes: 0 = clean, 1 = error-level findings, 2 = usage error
`;

type Format = "text" | "json";

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: "string", short: "f", default: "text" },
      config: { type: "string", short: "c" },
      url: { type: "string", multiple: true },
      dir: { type: "string" },
      routes: { type: "string" },
      headed: { type: "boolean", default: false },
      timeout: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", default: false },
    },
  });
}

async function main(argv: string[]): Promise<number> {
  let values: ReturnType<typeof parse>["values"];
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

  const format = values.format;
  if (format !== "text" && format !== "json") {
    process.stderr.write(`Invalid --format: ${format} (expected text|json)\n`);
    return 2;
  }

  if (command === "rules") {
    for (const rule of [...htmlRules, ...runtimeRules]) {
      process.stdout.write(
        `${rule.id.padEnd(28)} ${rule.defaultSeverity.padEnd(6)} ${rule.description}\n`,
      );
    }
    return 0;
  }

  const cwd = process.cwd();
  const { config } = await loadConfig(cwd, values.config);

  if (command === "static") {
    return runStatic(values, positionals.slice(1), config, cwd, format);
  }
  if (command === "runtime") {
    return runRuntimeCmd(values, config, cwd, format);
  }
  if (command === "ci") {
    process.stderr.write("`webmcp-lint ci` is not implemented yet (planned for M3).\n");
    return 2;
  }

  process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
  return 2;
}

async function runStatic(
  values: ReturnType<typeof parse>["values"],
  globs: string[],
  config: Awaited<ReturnType<typeof loadConfig>>["config"],
  cwd: string,
  format: Format,
): Promise<number> {
  const patterns =
    globs.length > 0
      ? globs
      : config.pages && config.pages.length > 0
        ? config.pages
        : DEFAULT_GLOBS;

  const files = await glob(patterns, {
    cwd,
    absolute: true,
    ignore: DEFAULT_IGNORE,
    dot: false,
  });

  if (files.length === 0) {
    process.stderr.write(`No HTML files matched: ${patterns.join(", ")}\n`);
    return 2;
  }

  const result = await analyzeHtmlFiles(files.sort(), config);
  const scope = `${result.stats.files} file(s), ${result.stats.tools} tool(s) checked`;

  emit(format, result.findings, result.stats, {
    cwd,
    scope,
    errors: result.stats.errors,
    warnings: result.stats.warnings,
    infos: result.stats.infos,
  });

  return result.stats.errors > 0 ? 1 : 0;
}

async function runRuntimeCmd(
  values: ReturnType<typeof parse>["values"],
  config: Awaited<ReturnType<typeof loadConfig>>["config"],
  cwd: string,
  format: Format,
): Promise<number> {
  const urls = values.url ?? [];
  if (urls.length === 0 && !values.dir) {
    process.stderr.write("runtime: pass --url <url> (repeatable) or --dir <path>\n");
    return 2;
  }

  let routes: string[] | undefined;
  if (values.routes) {
    try {
      routes = JSON.parse(await readFile(resolve(cwd, values.routes), "utf8")) as string[];
    } catch (err) {
      process.stderr.write(`runtime: could not read --routes file: ${String(err)}\n`);
      return 2;
    }
  }

  let runRuntime: typeof import("@webmcp-lint/runtime").runRuntime;
  try {
    ({ runRuntime } = await import("@webmcp-lint/runtime"));
  } catch (err) {
    process.stderr.write(
      "runtime: could not load @webmcp-lint/runtime. Install it and a browser:\n" +
        "  npm i -D @webmcp-lint/runtime && npx playwright install chromium\n" +
        `(${String(err)})\n`,
    );
    return 2;
  }

  let result;
  try {
    result = await runRuntime({
      urls,
      ...(values.dir ? { serveDir: resolve(cwd, values.dir) } : {}),
      ...(routes ? { routes } : {}),
      headless: !values.headed,
      ...(values.timeout ? { timeoutMs: Number(values.timeout) } : {}),
      config,
    });
  } catch (err) {
    const msg = String(err);
    if (/Executable doesn't exist|Looks like Playwright/.test(msg)) {
      process.stderr.write(
        "runtime: no browser found. Run:  npx playwright install chromium\n",
      );
      return 2;
    }
    process.stderr.write(`runtime: ${msg}\n`);
    return 2;
  }

  const scope = `${result.stats.pages} page(s), ${result.stats.tools} tool(s) invoked`;
  emit(format, result.findings, result.stats, {
    cwd,
    scope,
    errors: result.stats.errors,
    warnings: result.stats.warnings,
    infos: result.stats.infos,
  });

  return result.stats.errors > 0 ? 1 : 0;
}

function emit(
  format: Format,
  findings: Finding[],
  summary: Record<string, number>,
  text: Omit<Parameters<typeof renderText>[0], "findings">,
): void {
  process.stdout.write(
    (format === "json"
      ? renderJson(findings, summary)
      : renderText({ findings, ...text })) + "\n",
  );
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`webmcp-lint: ${(err as Error).stack ?? err}\n`);
    process.exit(2);
  });
