# confirm-state-changing

**Severity:** warn (see below) · **Fixable:** no

## Rationale

An agent can call a tool far faster, and far more casually, than a human
clicks a button. A tool whose handler mutates state — places an order,
deletes a record, changes a setting — needs some form of confirmation
before an agent can trigger it, the imperative-API equivalent of
[`no-autosubmit-destructive`](./no-autosubmit-destructive.md) for
declarative forms.

## What it flags

A tool whose `execute`/`handler` function body contains a `fetch(url, {
method: "POST" | "PUT" | "PATCH" | "DELETE" })` call, with neither:

- a `confirm(...)` (or `window.confirm(...)`) call in the handler, nor
- `annotations: { destructiveHint: true }` on the tool (Chrome/MCP's own
  vocabulary for self-labeling a tool as destructive, which a host is
  expected to gate on).

## Examples

```ts
// ✗ deletes with no gate
document.modelContext.registerTool({
  name: "delete_account",
  execute: ({ id }) => fetch(`/api/account/${id}`, { method: "DELETE" }),
});

// ✓ — self-labeled destructive
document.modelContext.registerTool({
  name: "delete_account",
  annotations: { destructiveHint: true },
  execute: ({ id }) => fetch(`/api/account/${id}`, { method: "DELETE" }),
});
```

## Known limitations — why this starts at `warn`, not `error`

Mutation detection is a text heuristic on the handler's own source: it
catches an inline `fetch(..., { method: "..." })` call, and nothing else. A
mutation hidden behind an abstraction — a `saveOrder()` helper, a store
action, a GraphQL mutation — won't be caught; conversely, a `fetch` call
that merely mentions a mutating-looking string won't necessarily be a real
mutation either. Chrome's own guidance suggests `error` as the target
severity, but this rule starts at `warn` until dogfooding across real
codebases shows the false-positive rate is low. Raise it to `"error"` in
your config once you've confirmed it's precise for your codebase.

## Fix

Add `annotations: { destructiveHint: true }`, and/or an explicit
confirmation step, before the mutating call runs.
