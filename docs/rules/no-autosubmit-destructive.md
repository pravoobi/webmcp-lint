# no-autosubmit-destructive

**Severity:** error · **Fixable:** no

## Rationale

The declarative WebMCP `toolautosubmit` attribute makes a form submit
*automatically* the moment an agent invokes the tool — no human in the loop.
Chrome's guidance is that auto-submit is only appropriate for **read-only**
operations (a search, a filter, a lookup). Auto-submitting a state-changing form
lets an agent place an order, delete an account, or transfer money without
confirmation.

## What it flags

`toolautosubmit` on a `<form>` where either:

- the method implies a mutation — `method="post"` (or a `_method` hidden field of
  `put` / `patch` / `delete`), or
- the form's `action`, `toolname`, or `name` matches a destructive pattern
  (`delete`, `remove`, `order`, `checkout`, `pay`, `purchase`, `transfer`,
  `cancel`, … — extend via `destructivePatterns` in config).

## Examples

```html
<!-- ✗ auto-submits a purchase -->
<form toolname="placeOrder" method="post" action="/checkout" toolautosubmit>…</form>

<!-- ✓ auto-submitting a read-only search is fine -->
<form toolname="search" method="get" action="/search" toolautosubmit>…</form>
```

## Fix

Remove `toolautosubmit`. The agent will still be able to fill and submit the
form, but only as an explicit, confirmable step.
