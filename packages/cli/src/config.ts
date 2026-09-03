import { pathToFileURL } from "node:url";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { WebmcpLintConfig } from "@webmcp-lint/rules";

const CANDIDATES = [
  "webmcp-lint.config.ts",
  "webmcp-lint.config.mjs",
  "webmcp-lint.config.js",
  "webmcp-lint.config.json",
];

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function importConfigModule(absPath: string): Promise<WebmcpLintConfig> {
  const mod = (await import(pathToFileURL(absPath).href)) as {
    default?: WebmcpLintConfig;
  } & WebmcpLintConfig;
  return mod.default ?? mod;
}

/**
 * Load a config file. If `explicitPath` is given it must exist; otherwise we
 * probe the known filenames in `cwd` and return `{}` when none are found.
 */
export async function loadConfig(
  cwd: string,
  explicitPath?: string,
): Promise<{ config: WebmcpLintConfig; path: string | null }> {
  if (explicitPath) {
    const abs = resolve(cwd, explicitPath);
    if (!(await exists(abs))) {
      throw new Error(`Config file not found: ${explicitPath}`);
    }
    return { config: await loadOne(abs), path: abs };
  }

  for (const name of CANDIDATES) {
    const abs = resolve(cwd, name);
    if (await exists(abs)) {
      return { config: await loadOne(abs), path: abs };
    }
  }
  return { config: {}, path: null };
}

async function loadOne(absPath: string): Promise<WebmcpLintConfig> {
  if (absPath.endsWith(".json")) {
    return JSON.parse(await readFile(absPath, "utf8")) as WebmcpLintConfig;
  }
  return importConfigModule(absPath);
}
