# secure-context

**Severity:** info · **Fixable:** no

## Rationale

`document.modelContext`/`navigator.modelContext` is only defined in a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) —
`https://`, `localhost`, or a few other exceptions. Registration code that
never accounts for this fails silently over plain `http://`: no error, no
tools, no obvious sign anything's wrong.

## What it flags

A file that registers at least one tool but never references
`isSecureContext` or `location.protocol` anywhere in the file — informational
only, since a dev server on `localhost` or an HTTPS-only deployment has
nothing to worry about here.

## Example

```ts
// ℹ fine on an HTTPS-only site or localhost dev server; silently no-ops elsewhere
document.modelContext.registerTool({ name: "t", /* … */ });

// or, if you want an explicit fallback:
if (window.isSecureContext && document.modelContext) {
  document.modelContext.registerTool({ name: "t", /* … */ });
} else {
  console.warn("WebMCP tools need a secure context (https://).");
}
```

## Fix

Nothing required if you only ever deploy over HTTPS. Otherwise, guard
registration on `isSecureContext` and surface a clear message when it's
false, rather than registration silently doing nothing.
