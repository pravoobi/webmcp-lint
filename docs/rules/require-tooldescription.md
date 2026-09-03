# require-tooldescription

**Severity:** error · **Fixable:** no

## Rationale

`tooldescription` is the only thing an agent has to decide *whether* to call a
tool. With no description the tool is effectively invisible, or worse, called at
the wrong time.

## What it flags

A tool-annotated `<form>` (has `toolname`, or `toolautosubmit`/`tooldescription`)
whose `tooldescription` is missing or empty after trimming.

## Fix

```html
<form toolname="addToCart"
      tooldescription="Add the given product and quantity to the shopping cart">
```

Describe the action and when to use it — a full sentence, not a label. See
[`description-quality`](./description-quality.md) for the quality bar.
