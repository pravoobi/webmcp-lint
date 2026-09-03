# webmcp-lint rules

Generated from the rule catalog — do not edit by hand
(`node scripts/gen-rule-docs.mjs`).

| Rule | Kind | Default | Fixable | Summary |
|------|------|---------|---------|---------|
| [`no-autosubmit-destructive`](./no-autosubmit-destructive.md) | html | error | — | Disallow `toolautosubmit` on forms that mutate state or look destructive. |
| [`no-sensitive-inputs-exposed`](./no-sensitive-inputs-exposed.md) | html | error | — | Disallow password/file/hidden inputs from appearing in a tool's input schema. |
| [`require-tooldescription`](./require-tooldescription.md) | html | error | — | Require every declarative tool to carry a `tooldescription`. |
| [`description-quality`](./description-quality.md) | html | warn | — | Flag placeholder or too-short `tooldescription` values. |
| [`named-inputs`](./named-inputs.md) | html | warn | yes | Flag tool form controls without a `name` (silently dropped from the schema). |
| [`unique-toolnames`](./unique-toolnames.md) | html | error | — | Require tool names to be unique across all scanned pages. |
| [`registers-cleanly`](./registers-cleanly.md) | runtime | error | — | Page load should register tools once, with no duplicate registrations or errors. |
| [`schema-validates`](./schema-validates.md) | runtime | warn | — | Each tool should run cleanly on a schema-valid input and never hang. |
| [`no-side-effects-on-read`](./no-side-effects-on-read.md) | runtime | error | — | Invoking a read-only tool must not fire non-GET network requests. |

## Configuring

Set a level per rule in `webmcp-lint.config.*`:

```ts
export default {
  rules: {
    "description-quality": "off",     // "error" | "warn" | "info" | "off"
    "schema-validates": "error",
  },
};
```

- **html** rules run in `webmcp-lint static` (parse5, no browser).
- **runtime** rules run in `webmcp-lint runtime` (Playwright + the WebMCP polyfill).
- `webmcp-lint ci` runs both.
