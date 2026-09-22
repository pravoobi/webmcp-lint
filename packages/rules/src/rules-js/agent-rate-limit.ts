import type { JsRule, RawFinding } from "../types.js";
import {
  hasAgentInvokedCheck,
  hasThrottleOrDebounce,
  looksLikeMutatingFetch,
  toolLabel,
} from "./util.js";

export const agentRateLimit: JsRule = {
  id: "agent-rate-limit",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/agent-rate-limit.md",
  defaultSeverity: "warn",
  fixable: false,
  description:
    "Flag a mutating tool handler with no throttle/debounce and no `agentInvoked` branch.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.toolCalls) {
        if (!tool.handlerText) continue;
        // Scoped to mutating handlers — a read-only tool being called
        // repeatedly is an efficiency question, not a safety one.
        if (!looksLikeMutatingFetch(tool.handlerText)) continue;
        if (hasAgentInvokedCheck(tool.handlerText)) continue;
        if (hasThrottleOrDebounce(tool.handlerText)) continue;

        out.push({
          ruleId: "agent-rate-limit",
          file: parse.file,
          loc: tool.handlerLoc ?? tool.loc,
          confidence: "low",
          message:
            `Tool ${toolLabel(tool)}'s handler mutates state with no throttle/debounce and no ` +
            "check on `event.agentInvoked`. An agent can call a tool far faster than a human " +
            "clicks — nothing here slows repeated calls down.",
          suggestion:
            "Add a debounce/rate-limit, or branch on `event.agentInvoked` to apply a stricter " +
            "limit for agent-triggered calls than human ones.",
        });
      }
    }
    return out;
  },
};
