# schema-descriptions

**Severity:** warn · **Fixable:** no

## Rationale

Property `description`s are how an agent knows what value to pass for each
argument. A schema property with no description means the agent is guessing
from the property name alone.

## What it flags

A property inside a tool's `inputSchema.properties` object with no
`description` field. Only checked when `inputSchema.properties` is itself
a statically-readable object literal.

## Examples

```ts
// ✗ "limit" has no description
inputSchema: {
  type: "object",
  properties: {
    q: { type: "string", description: "search text" },
    limit: { type: "number" },
  },
}

// ✓
inputSchema: {
  type: "object",
  properties: {
    q: { type: "string", description: "search text" },
    limit: { type: "number", description: "max results to return (default 10)" },
  },
}
```

## Fix

Add a `description` to the flagged property.
