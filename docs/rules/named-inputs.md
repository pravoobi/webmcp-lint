# named-inputs

**Severity:** warn · **Fixable:** yes (mirror `id` to `name`)

## Rationale

WebMCP builds a tool's input schema from a form's **named** controls. A control
with only an `id` (or neither) is silently dropped — the agent never learns the
field exists, and submissions are missing data.

## What it flags

Inside a tool-annotated `<form>`, a data control (`input` that isn't
submit/button/reset/image, `select`, `textarea`) with no `name`:

- has an `id` → high confidence (almost certainly a mistake)
- has neither → medium confidence

## Fix

```html
<input id="email" name="email" type="email" />
```

`--fix` mirrors the `id` onto `name`. If the field genuinely shouldn't be in the
schema, that's fine — but make it deliberate.
