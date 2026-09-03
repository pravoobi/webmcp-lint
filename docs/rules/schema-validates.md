# schema-validates (runtime)

**Severity:** warn · **Fixable:** no

## Rationale

An agent builds a tool call from `inputSchema`. If the tool then throws on a
schema-valid input, or hangs, the agent has no way to recover — the schema lied.

## What it flags

The harness generates a minimal valid input from the schema and invokes the tool:

- **Rejected on valid input** — the `execute` handler threw for input that
  matches its own schema (e.g. it assumes a `string` where the schema says
  `number`). High confidence.
- **Timed out on valid input** — the call never resolved. An agent would hang.
- **Timed out on invalid input** — the tool should fail fast, not stall.
- **Skipped** — a declarative form without `toolautosubmit` can't be invoked
  without a human submit; reported at low confidence so you know it wasn't
  covered.

Note: the polyfill does not deeply validate input types, so "tool accepted a
wrong-typed value" is *not* flagged here — that would mostly measure the polyfill.

## Fix

Make the handler match the schema it advertises, and validate/normalise its
input at the top of `execute`. Return actionable error text on failure.
