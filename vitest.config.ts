import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@pravoobi/webmcp-lint-rules": r("./packages/rules/src/index.ts"),
      "@pravoobi/webmcp-lint-static": r("./packages/static/src/index.ts"),
    },
  },
});
