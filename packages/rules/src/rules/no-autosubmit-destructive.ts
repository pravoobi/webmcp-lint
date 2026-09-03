import type { HtmlRule, RawFinding } from "../types.js";
import { isMutatingMethod, toolLabel } from "./util.js";

export const noAutosubmitDestructive: HtmlRule = {
  id: "no-autosubmit-destructive",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/no-autosubmit-destructive.md",
  defaultSeverity: "error",
  fixable: false,
  description:
    "Disallow `toolautosubmit` on forms that mutate state or look destructive.",
  check(parses, ctx) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.tools) {
        if (!tool.autosubmit) continue;

        const mutating = isMutatingMethod(tool);
        const haystack = [tool.action, tool.name ?? "", tool.formName ?? ""]
          .join(" ")
          .toLowerCase();
        const destructiveName = ctx.destructiveRegex.test(haystack);

        if (!mutating && !destructiveName) continue;

        const why = mutating
          ? `a ${(tool.method || "POST").toUpperCase()} form`
          : "a form whose name/action looks state-changing";

        out.push({
          ruleId: "no-autosubmit-destructive",
          file: parse.file,
          loc: tool.loc,
          confidence: destructiveName ? "high" : "medium",
          message:
            `Tool ${toolLabel(tool)} sets \`toolautosubmit\` on ${why}. ` +
            "Chrome's guidance is to auto-submit only read-only operations; a " +
            "state-changing form should require the agent (and user) to confirm.",
          suggestion:
            "Remove the `toolautosubmit` attribute so the agent must explicitly " +
            "submit this form after confirmation.",
        });
      }
    }
    return out;
  },
};
