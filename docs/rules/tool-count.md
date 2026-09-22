# tool-count

**Severity:** info · **Fixable:** no

## Rationale

Agents degrade with large tool menus — more tools means more of the
context window spent describing options the agent probably won't use, and
a harder job picking the right one. Chrome's guidance suggests keeping a
page's tool surface small and focused.

## What it flags

More than `toolCountMax` (default **15**) tool registration call sites
across all files passed to one `webmcp-lint static` invocation. Static
analysis can't know how scanned files compose into a running page — like
[`unique-toolnames`](./unique-toolnames.md), this treats everything given
to one invocation as one surface. Points at whichever call site tips the
count over the threshold.

Note this counts **call sites in source**, not runtime registrations — a
`registerTool(...)` call inside a loop that runs 20 times at runtime is
still one call site as far as this rule is concerned.

## Configuring

```ts
// webmcp-lint.config.ts
export default {
  toolCountMax: 25,
};
```

## Fix

Split tools by page/route so each page only registers what it needs, or
group related tools behind fewer, more general ones.
