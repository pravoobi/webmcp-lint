# registration-surface

**Severity:** warn · **Fixable:** no

## Rationale

The WebMCP registration surface has moved before (`navigator.modelContext`
→ `document.modelContext`) across Chrome versions, and polyfills don't all
agree on which they expose. Code that hardcodes one will break outright if
the surface moves again, or on a polyfill/browser that only implements the
other.

## What it flags

A file that references `navigator.modelContext` or `document.modelContext`
but never the other. If a file references **both** anywhere — most commonly
`document.modelContext ?? navigator.modelContext` — it's assumed to already
be feature-detecting and nothing is flagged.

## Examples

```ts
// ✗ only ever checks navigator
navigator.modelContext.registerTool({ name: "t" });

// ✓ feature-detects both
const mc = document.modelContext ?? navigator.modelContext;
mc.registerTool({ name: "t" });
```

## Known limitations

This is a file-level signal, not a per-expression one: if a file references
both surfaces *anywhere*, no reference in that file is flagged, even if a
specific `registerTool` call only reaches one of them. Confirming that a
particular fallback actually protects a particular call would need real
data-flow analysis; this stays conservative to avoid noisy false positives.

## Fix

Feature-detect both surfaces — `document.modelContext ?? navigator.modelContext`,
or an explicit `if`/`typeof` check for each — rather than hardcoding one.
