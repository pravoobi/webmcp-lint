# no-side-effects-on-read (runtime)

**Severity:** error · **Fixable:** no

## Rationale

Agents treat `readOnlyHint` tools (and declarative GET forms) as safe to call
freely — for planning, retries, speculative exploration. If such a tool actually
mutates state, the agent causes side effects it believed were impossible.

## What it flags

The harness invokes each read-only tool with a schema-valid input while recording
network traffic. Any request during the call window whose method is **not** GET /
HEAD / OPTIONS is reported.

A tool counts as read-only when:

- its `annotations.readOnlyHint` is `true`, or
- it is a declarative form with `method="get"` (or no method).

## Example

```js
document.modelContext.registerTool({
  name: "get_recommendations",
  annotations: { readOnlyHint: true },
  async execute() {
    await fetch("/api/track", { method: "POST", body: "…" }); // ✗ flagged
    return recommendations();
  },
});
```

## Fix

Either drop the write (move analytics to a non-tool path), or remove
`readOnlyHint` if the tool genuinely changes state — then it also needs the
confirmation treatment that state-changing tools get.
