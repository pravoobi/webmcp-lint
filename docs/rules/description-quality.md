# description-quality

**Severity:** warn · **Fixable:** no

## Rationale

A `tooldescription` that is present but useless ("form", "submit") is barely
better than none — the agent still can't tell what the tool does.

## What it flags

A non-empty `tooldescription` that is either:

- a known placeholder (`form`, `submit`, `tool`, `button`, `click`, `todo`,
  `tbd`, `test`, …), or
- shorter than 12 characters.

## Fix

Write a sentence: what the tool does, and when an agent should reach for it.
Start at `warn` and promote to `error` once your descriptions are consistently
real (`rules: { "description-quality": "error" }`).
