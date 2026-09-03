import type { RuleLevel, Severity } from "./types.js";

export interface WebmcpLintConfig {
  /**
   * Per-rule level overrides, keyed by rule id. `"off"` disables a rule.
   * Unspecified rules use their built-in default severity.
   */
  rules?: Record<string, RuleLevel>;
  /**
   * Extra case-insensitive substrings/patterns that mark a form as
   * "destructive" for `no-autosubmit-destructive`. Merged with the defaults.
   */
  destructivePatterns?: string[];
  /**
   * Replace (rather than extend) the default destructive patterns.
   */
  destructivePatternsReplace?: string[];
  /** Glob(s) of pages to scan when none are passed on the CLI. */
  pages?: string[];
}

/**
 * Default destructive tokens. Chrome's guidance is that `toolautosubmit`
 * (auto-submitting a form when an agent calls the tool) is only appropriate for
 * read-only operations. These tokens flag form actions/names that clearly are not.
 */
export const DEFAULT_DESTRUCTIVE_PATTERNS: string[] = [
  "delete",
  "remove",
  "destroy",
  "drop",
  "order",
  "checkout",
  "pay",
  "payment",
  "purchase",
  "buy",
  "charge",
  "transfer",
  "withdraw",
  "refund",
  "cancel",
  "unsubscribe",
  "deactivate",
  "revoke",
];

export interface ResolvedConfig {
  rules: Record<string, RuleLevel>;
  destructiveRegex: RegExp;
  pages: string[];
}

export function resolveConfig(user: WebmcpLintConfig = {}): ResolvedConfig {
  const patterns = user.destructivePatternsReplace
    ? user.destructivePatternsReplace
    : [...DEFAULT_DESTRUCTIVE_PATTERNS, ...(user.destructivePatterns ?? [])];

  return {
    rules: { ...(user.rules ?? {}) },
    destructiveRegex: new RegExp(patterns.map((p) => `(?:${p})`).join("|"), "i"),
    pages: user.pages ?? [],
  };
}

export function resolveLevel(
  ruleId: string,
  defaultSeverity: Severity,
  rules: Record<string, RuleLevel>,
): RuleLevel {
  return rules[ruleId] ?? defaultSeverity;
}
