import type { JsToolCallSite } from "../types.js";

export function toolLabel(tool: JsToolCallSite): string {
  return tool.name ? `"${tool.name}"` : "(unnamed tool)";
}

/**
 * A `fetch(url, { method: "POST" | ... })` call with a mutating method,
 * matched on the handler's raw source text. Deliberately narrow: it only
 * catches the literal-method-in-the-call-site shape, which is what every
 * real example we've dogfooded against uses. A mutation hidden behind an
 * abstraction (a `saveOrder()` helper, a store action) won't be caught —
 * that's a known, documented limitation, not a bug: guessing at arbitrary
 * function names is far more likely to be wrong than useful.
 */
const MUTATING_FETCH_RE =
  /\bfetch\s*\([^)]*\bmethod\s*:\s*["'`](post|put|patch|delete)["'`]/is;

export function looksLikeMutatingFetch(handlerText: string): boolean {
  return MUTATING_FETCH_RE.test(handlerText);
}

const CONFIRM_RE = /\bconfirm\s*\(/;

/**
 * A recognizable "ask before doing it" gate: an explicit `confirm(...)` /
 * `window.confirm(...)` call, or the tool honestly self-labels as
 * destructive via `annotations.destructiveHint: true` — Chrome's own
 * annotation vocabulary, which a host/agent is expected to gate on.
 */
export function looksGated(tool: JsToolCallSite): boolean {
  if (tool.annotations.destructiveHint === true) return true;
  return tool.handlerText != null && CONFIRM_RE.test(tool.handlerText);
}

export function hasAgentInvokedCheck(handlerText: string): boolean {
  return /agentInvoked/.test(handlerText);
}

const THROTTLE_RE = /debounce|throttle|rate[-_]?limit|cooldown|lastCall(?:ed)?(?:At|Time)/i;

export function hasThrottleOrDebounce(handlerText: string): boolean {
  return THROTTLE_RE.test(handlerText);
}
