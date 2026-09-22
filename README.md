# webmcp-lint

A CI linter + runtime test harness that checks a site's **WebMCP** tools
against Chrome's guidance and general agent-safety rules — the "eslint + axe-core
of agent-readiness".

WebMCP has real safety footguns: auto-submitting a "place order" form, exposing
password/hidden inputs to an agent, letting agents hammer a mutation at machine
speed. Chrome documents the guidance; nothing enforces it in CI. This does.

## Status

Milestones **M1–M3** are implemented: the rule engine, the declarative-HTML
static analyzer, the Playwright runtime harness (real `@mcp-b/webmcp-polyfill`
injected), nine built-in rules, `text` / `json` / `sarif` / `github` reporters,
a `ci` command, and a composite GitHub Action.

| Milestone | Scope | State |
|-----------|-------|-------|
| M1 | rule engine + static HTML rules + text/json reporters | ✅ done |
| M2 | Playwright runtime harness w/ polyfill injection, 3 runtime rules | ✅ done |
| M3 | SARIF + `github` reporters, `webmcp-lint ci`, GitHub Action, rule docs | ✅ done |
| M4 | dogfood on real apps + publish | ⬜ |

## Install & run (from a checkout)

```bash
pnpm install
pnpm build
node packages/cli/dist/index.js static "**/*.html"

# runtime needs a browser once:
pnpm --filter @pravoobi/webmcp-lint-runtime exec playwright install chromium
node packages/cli/dist/index.js runtime --dir ./dist --routes routes.json
```

## CLI

```
webmcp-lint static [globs...]        HTML static rules (no browser)
webmcp-lint runtime [--url <u>...]   Load pages w/ the WebMCP polyfill, inspect + invoke tools
webmcp-lint ci [globs...]            static + runtime together, for CI
webmcp-lint rules                    List built-in rules

  -f, --format <text|json|sarif|github>  Output format (default: text)
  -c, --config <path>                    webmcp-lint.config.{ts,js,mjs,json}
  -o, --output <file>                    Write the report to a file
      --sarif-output <file>              Also write SARIF (for code-scanning upload)

runtime / ci:
      --url <url>                    Page to check (repeatable)
      --dir <path>                   Serve this dir on localhost and check it
      --routes <file.json>           JSON array of extra paths to visit per origin
      --headed                       Show the browser
      --timeout <ms>                 Navigation / invocation timeout (default 15000)
      --no-runtime                   (ci) static pass only
```

## GitHub Action

`action/` is a composite action that runs `webmcp-lint ci`, uploads SARIF to code
scanning, and posts a PR summary comment. See [`action/README.md`](./action/README.md).

```yaml
- uses: pravoobi/webmcp-lint/action@v1
  with:
    build-command: npm run build
    serve-command: npx serve -l 3000 dist
    serve-ready-url: http://localhost:3000
    url: |
      http://localhost:3000/
      http://localhost:3000/checkout
```

Exit code is `1` when any error-level finding is present, `0` when clean, `2` on
usage errors.

## Rules

Full list with per-rule docs: [`docs/rules/`](./docs/rules/README.md).

### Static rules (M1)

Operate on `<form>` elements carrying the declarative WebMCP attributes
(`toolname`, `tooldescription`, `toolautosubmit` — `tool-` and `data-tool-`
prefixes are also accepted).

| Rule | Default | What it catches |
|------|---------|-----------------|
| `no-autosubmit-destructive` | error | `toolautosubmit` on a POST form, or one whose name/action matches destructive patterns |
| `no-sensitive-inputs-exposed` | error | `type=password` / `type=file` / named hidden inputs that land in the tool schema |
| `require-tooldescription` | error | tool form with no `tooldescription` |
| `description-quality` | warn | placeholder or very short descriptions ("form", "submit", …) |
| `named-inputs` | warn | controls with an `id` but no `name` (silently dropped from the schema) |
| `unique-toolnames` | error | the same `toolname` registered on more than one page |

### Runtime rules (M2)

The harness injects `@mcp-b/webmcp-polyfill` via a Playwright init script, loads
each page over `http://localhost` (a secure context), reads
`document.modelContext.getTools()`, and invokes every tool with a schema-valid
and a schema-invalid input (declarative forms without `toolautosubmit` are
skipped — they wait for a human submit).

| Rule | Default | What it catches |
|------|---------|-----------------|
| `registers-cleanly` | error | duplicate registration (React StrictMode double-mount), rejected/never-settled registrations, uncaught errors on load |
| `schema-validates` | warn | a tool that rejects or hangs on its own schema-valid input; hangs on invalid input |
| `no-side-effects-on-read` | error | a `readOnlyHint` tool (or GET form) that fires a non-GET request when invoked |

## Config

`webmcp-lint.config.{ts,js,mjs,json}` in the working directory (or `--config`):

```ts
export default {
  rules: {
    "description-quality": "off",
    "schema-validates": "error",
  },
  destructivePatterns: ["gift", "redeem"],
  pages: ["public/**/*.html"],
};
```

## Packages

- `packages/rules` — pure rule engine + static and runtime rules (no I/O; runtime
  rules analyze a plain `RuntimeObservation` the harness produces)
- `packages/static` — parse5-based HTML analyzer
- `packages/runtime` — Playwright harness + polyfill injection + tool invocation
- `packages/cli` — `webmcp-lint` command + reporters

## Development

```bash
pnpm test          # vitest, resolves packages from source (runtime suite needs chromium)
pnpm -r build      # tsc, topological
pnpm -r typecheck
```
