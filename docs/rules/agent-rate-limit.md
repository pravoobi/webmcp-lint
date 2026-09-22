# agent-rate-limit

**Severity:** warn · **Fixable:** no

## Rationale

Nothing stops an agent from calling a tool in a tight loop. A mutating
handler with no throttle and no awareness of `event.agentInvoked` (WebMCP's
signal that a call came from an agent, not a human click) can be hammered
at machine speed — "agents hammering a mutation at machine speed" is
exactly the footgun this whole project exists to catch.

## What it flags

A tool whose handler contains a mutating `fetch(..., { method: "POST" |
"PUT" | "PATCH" | "DELETE" })` call, with neither:

- a reference to `agentInvoked` in the handler (e.g. branching on
  `event.agentInvoked` to apply a stricter limit for agent calls), nor
- an identifiable debounce/throttle/rate-limit pattern (`debounce(...)`,
  `throttle(...)`, a `cooldown`/`lastCall`-ish identifier).

Scoped to mutating handlers only — a read-only tool being called
repeatedly is an efficiency question, not a safety one.

## Examples

```ts
// ✗ no throttle, no agentInvoked awareness
execute: ({ id }) => fetch(`/api/like/${id}`, { method: "POST" });

// ✓
execute: (args, event) => {
  if (event.agentInvoked) return rateLimited(() => doLike(args));
  return doLike(args);
};
```

## Known limitations

Same text-heuristic caveats as
[`confirm-state-changing`](./confirm-state-changing.md): it only sees a
mutation shaped as an inline `fetch` call, and a throttle implemented under
a name this rule doesn't recognize won't be detected. Lowest-confidence
rule in the set — treat findings as a prompt to look, not a guaranteed bug.

## Fix

Debounce/rate-limit the handler, or branch on `event.agentInvoked` to apply
a stricter limit than you would for a human-triggered call.
