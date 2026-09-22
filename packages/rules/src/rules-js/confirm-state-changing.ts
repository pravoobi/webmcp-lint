import type { JsRule, RawFinding } from "../types.js";
import { looksGated, looksLikeMutatingFetch, toolLabel } from "./util.js";

export const confirmStateChanging: JsRule = {
  id: "confirm-state-changing",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/confirm-state-changing.md",
  // The spec's target severity is `error`, but mutation detection is a text
  // heuristic on the handler body (fetch-with-a-mutating-method) that misses
  // anything behind an abstraction (a `saveOrder()` helper, a store action) —
  // and can't see one that's there. Starting at `warn` until dogfooding
  // proves the false-positive rate low, per the spec's own risk note.
  defaultSeverity: "warn",
  fixable: false,
  description:
    "Flag a tool handler that performs a mutating fetch with no confirmation gate.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.toolCalls) {
        if (!tool.handlerText) continue;
        if (!looksLikeMutatingFetch(tool.handlerText)) continue;
        if (looksGated(tool)) continue;

        out.push({
          ruleId: "confirm-state-changing",
          file: parse.file,
          loc: tool.handlerLoc ?? tool.loc,
          confidence: "medium",
          message:
            `Tool ${toolLabel(tool)}'s handler sends a mutating request (POST/PUT/PATCH/DELETE) ` +
            "with no confirmation gate found (no `confirm(...)` call, no `annotations." +
            "destructiveHint: true`). Chrome's guidance is that a state-changing tool should " +
            "require confirmation before an agent can trigger it at machine speed.",
          suggestion:
            "Set `annotations: { destructiveHint: true }` so hosts gate on it, and/or add an " +
            "explicit confirmation step before the mutating call.",
        });
      }
    }
    return out;
  },
};
