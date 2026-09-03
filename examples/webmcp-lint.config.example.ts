import type { WebmcpLintConfig } from "@webmcp-lint/rules";

/**
 * Copy this to `webmcp-lint.config.ts` in your project root.
 */
const config: WebmcpLintConfig = {
  rules: {
    // start noisy heuristics as warnings until precision is proven
    "description-quality": "warn",
  },
  destructivePatterns: ["redeem", "gift-card"],
  pages: ["public/**/*.html", "app/**/*.html"],
};

export default config;
