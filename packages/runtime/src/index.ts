import {
  countBySeverity,
  runRuntimeRules,
  type Finding,
  type RuntimeObservation,
  type WebmcpLintConfig,
} from "@webmcp-lint/rules";
import { observeUrls, type HarnessOptions } from "./browser.js";
import { serveDir } from "./server.js";

export { observeUrls, type HarnessOptions } from "./browser.js";
export { serveDir, type StaticServer } from "./server.js";
export { validSample, invalidSample } from "./sample.js";
export { polyfillInitScript, loadPolyfillSource } from "./polyfill.js";

export interface RuntimeRunOptions extends HarnessOptions {
  /** One or more URLs to check. */
  urls?: string[];
  /** Or: serve this local directory and check its pages. */
  serveDir?: string;
  /** Paths (relative to the served dir / first URL origin) to also visit. */
  routes?: string[];
  config?: WebmcpLintConfig;
}

export interface RuntimeResult {
  findings: Finding[];
  observations: RuntimeObservation[];
  stats: {
    pages: number;
    tools: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

function resolveTargets(
  base: string[],
  routes: string[] | undefined,
): string[] {
  if (!routes || routes.length === 0) return base;
  // When routes are given, visit exactly those paths per origin (not the bare origin).
  const out: string[] = [];
  for (const b of base) {
    for (const route of routes) out.push(new URL(route, b).href);
  }
  return out;
}

export async function runRuntime(options: RuntimeRunOptions): Promise<RuntimeResult> {
  let server: Awaited<ReturnType<typeof serveDir>> | null = null;
  let urls = options.urls ?? [];

  if (options.serveDir) {
    server = await serveDir(options.serveDir);
    urls = [server.url, ...urls];
  }
  if (urls.length === 0) {
    throw new Error("runRuntime: provide `urls` or `serveDir`");
  }

  try {
    const targets = resolveTargets(urls, options.routes);
    const observations = await observeUrls(targets, options);
    const findings = runRuntimeRules(observations, { config: options.config });
    const counts = countBySeverity(findings);
    return {
      findings,
      observations,
      stats: {
        pages: observations.length,
        tools: observations.reduce((n, o) => n + o.tools.length, 0),
        errors: counts.error,
        warnings: counts.warn,
        infos: counts.info,
      },
    };
  } finally {
    if (server) await server.close();
  }
}
