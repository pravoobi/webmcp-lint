# schema-required

**Severity:** error · **Fixable:** no

## Rationale

An agent has to know what arguments a tool accepts before it can call it. A
`registerTool`/hook call with no `inputSchema` gives it nothing to go on —
the agent either guesses, or skips the tool entirely.

## What it flags

An imperative tool registration (`document.modelContext.registerTool(...)`,
`navigator.modelContext.registerTool(...)`, or a hook whose name contains
"mcp", e.g. `useWebMCP`) whose object literal has no `inputSchema` property.

Only fires when the call's argument is a statically-resolvable object
literal (inline, or a same-file `const x = {...}`) — a tool built by a
helper function or imported is "unknown", not "missing", and isn't flagged.

## Examples

```ts
// ✗ no inputSchema — agent has no idea what to pass
document.modelContext.registerTool({
  name: "search_catalog",
  execute: (args) => search(args),
});

// ✓
document.modelContext.registerTool({
  name: "search_catalog",
  inputSchema: {
    type: "object",
    properties: { q: { type: "string", description: "search text" } },
  },
  execute: ({ q }) => search(q),
});
```

## Fix

Add an `inputSchema` (JSON Schema object) describing the tool's parameters.
