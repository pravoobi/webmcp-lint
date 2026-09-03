import type { RawFinding } from "../../types.js";
import type { RuntimeRule } from "../types.js";

const DUPLICATE_RE = /already registered|already exists|duplicate/i;

export const registersCleanly: RuntimeRule = {
  id: "registers-cleanly",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/registers-cleanly.md",
  defaultSeverity: "error",
  fixable: false,
  description:
    "Page load should register tools once, with no duplicate registrations or errors.",
  check(observations) {
    const out: RawFinding[] = [];
    for (const obs of observations) {
      const at = (line: number) => ({ file: obs.url, line, column: 1 });

      if (!obs.loadOk) {
        out.push({
          ruleId: "registers-cleanly",
          file: obs.url,
          loc: at(1),
          confidence: "high",
          message: `Page failed to load: ${obs.loadError ?? "unknown error"}`,
        });
        continue;
      }

      // Duplicate registration attempts (StrictMode double-mount is the classic cause).
      const byName = new Map<string, number>();
      for (const a of obs.registrationAttempts) {
        if (a.name == null) continue;
        byName.set(a.name, (byName.get(a.name) ?? 0) + 1);
      }
      for (const [name, count] of byName) {
        if (count > 1) {
          out.push({
            ruleId: "registers-cleanly",
            file: obs.url,
            loc: at(1),
            confidence: "high",
            message:
              `Tool "${name}" was registered ${count} times on one page load. ` +
              "This is usually React StrictMode / double-mounting; register once and " +
              "tie the registration lifetime to an AbortSignal.",
          });
        }
      }
      for (const a of obs.registrationAttempts) {
        if (a.ok === false && a.error && DUPLICATE_RE.test(a.error) && (byName.get(a.name ?? "") ?? 0) <= 1) {
          out.push({
            ruleId: "registers-cleanly",
            file: obs.url,
            loc: at(1),
            confidence: "high",
            message: `Registration of tool "${a.name ?? "(unnamed)"}" was rejected: ${a.error}`,
          });
        }
        if (a.ok === null) {
          out.push({
            ruleId: "registers-cleanly",
            file: obs.url,
            loc: at(1),
            confidence: "medium",
            message: `Registration of tool "${a.name ?? "(unnamed)"}" never settled.`,
          });
        }
      }

      for (const err of obs.pageErrors) {
        out.push({
          ruleId: "registers-cleanly",
          file: obs.url,
          loc: at(1),
          confidence: "medium",
          message: `Uncaught error during page load: ${err}`,
        });
      }
      for (const err of obs.consoleErrors) {
        if (!/tool|modelcontext|register|schema/i.test(err)) continue;
        out.push({
          ruleId: "registers-cleanly",
          file: obs.url,
          loc: at(1),
          confidence: "low",
          message: `Console error during page load: ${err}`,
        });
      }

      if (obs.tools.length === 0 && obs.registrationAttempts.length === 0) {
        out.push({
          ruleId: "registers-cleanly",
          file: obs.url,
          loc: at(1),
          confidence: "medium",
          message:
            "No WebMCP tools registered on this page. If tools are expected, the " +
            "registration code may not be running (wrong surface, http:// context, or a build issue).",
        });
      }
    }
    return out;
  },
};
