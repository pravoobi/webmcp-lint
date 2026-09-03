import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let cached: string | null = null;

/**
 * The `@mcp-b/webmcp-polyfill` standalone IIFE bundle. It auto-initialises on
 * load, reading `window.__webMCPPolyfillOptions`, and installs
 * `document.modelContext` (plus the deprecated `navigator.modelContext` alias).
 */
export function loadPolyfillSource(overridePath?: string): string {
  if (overridePath) return readFileSync(overridePath, "utf8");
  if (cached) return cached;
  const resolved = require.resolve("@mcp-b/webmcp-polyfill/iife");
  cached = readFileSync(resolved, "utf8");
  return cached;
}

/** Init script: set options, then evaluate the polyfill bundle. */
export function polyfillInitScript(overridePath?: string): string {
  return (
    "window.__webMCPPolyfillOptions = window.__webMCPPolyfillOptions || { installTestingShim: true };\n" +
    loadPolyfillSource(overridePath)
  );
}
