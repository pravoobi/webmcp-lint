# no-sensitive-inputs-exposed

**Severity:** error · **Fixable:** no

## Rationale

An agent fills a tool's input schema. If that schema includes a password, a file
input, or a hidden field, the agent can be steered into typing credentials,
leaking a local path, or tampering with a value the page assumed was fixed
(CSRF tokens, prices, ids). The auto-webmcp generator drops these; hand-written
annotations usually don't.

## What it flags

Inside a tool-annotated `<form>`, a control that would land in the schema
(`name` present, data control) and is:

- `type="password"` — high confidence
- `type="file"` — high confidence
- a named `type="hidden"` input — medium confidence

## Fix

- Password: collect it outside the agent flow entirely.
- File: remove it from the tool; uploads aren't agent-drivable.
- Hidden: keep the value server-side, or leave the input un-`name`d so it stays
  out of the schema.
