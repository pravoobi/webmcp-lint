import type { JsRule, RawFinding } from "../types.js";

const AWARE_RE = /isSecureContext|location\.protocol/;

export const secureContext: JsRule = {
  id: "secure-context",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/secure-context.md",
  defaultSeverity: "info",
  fixable: false,
  description:
    "Registration code should be secure-context aware — `modelContext` is undefined off HTTPS.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      if (parse.toolCalls.length === 0) continue;
      if (AWARE_RE.test(parse.source)) continue; // already checks isSecureContext / location.protocol

      const first = parse.toolCalls[0]!;
      out.push({
        ruleId: "secure-context",
        file: parse.file,
        loc: first.loc,
        confidence: "low",
        message:
          "This file registers WebMCP tools but never checks `isSecureContext` or " +
          "`location.protocol`. `modelContext` is only defined in a secure context — " +
          "registration silently no-ops over plain HTTP. Informational: fine for a dev " +
          "server or an HTTPS-only deployment; worth a guard (and a fallback message) if not.",
      });
    }
    return out;
  },
};
