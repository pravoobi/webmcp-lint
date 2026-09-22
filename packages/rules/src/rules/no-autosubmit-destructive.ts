import type { HtmlRule, RawFinding } from "../types.js";
import { isMutatingMethod, looksReadOnly, toolLabel } from "./util.js";

export const noAutosubmitDestructive: HtmlRule = {
  id: "no-autosubmit-destructive",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/no-autosubmit-destructive.md",
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
        // A destructive-looking noun (e.g. "order") paired with a read verb
        // (e.g. "get_order_status") is a lookup, not a mutation — only trust
        // the name heuristic when nothing marks it as a read.
        const destructiveName = ctx.destructiveRegex.test(haystack) && !looksReadOnly(haystack);

        if (!mutating && !destructiveName) continue;

        const why = mutating
          ? `a ${(tool.method || "POST").toUpperCase()} form`
          : "a form whose name/action looks state-changing";

        out.push({
          ruleId: "no-autosubmit-destructive",
          file: parse.file,
          loc: tool.loc,
          // The HTTP method is a hard fact; a name/action substring match is
          // a guess, so it's lower confidence and — unless the method also
          // mutates — capped at `warn` rather than the rule's default `error`.
          confidence: mutating ? "high" : "medium",
          ...(mutating ? {} : { severity: "warn" }),
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
