# CLAUDE.md — webmcp-lint

A CI linter + runtime test harness that checks a site's WebMCP tools against Chrome's guidance and general agent-safety rules: no `toolautosubmit` on destructive forms, confirmation on state-changing tools, agent-call rate limiting via `event.agentInvoked`, schema quality, and secure-context requirements.

## Why this exists

WebMCP has real safety footguns (auto-submitting a "place order" form, exposing hidden/password inputs, letting agents hammer a mutation at machine speed). Chrome documents the guidance but nothing enforces it in CI. This is the "eslint + axe-core of agent-readiness."

## Deliverables

1. `packages/rules` — rule engine + built-in rules (pure, testable)
2. `packages/static` — static analyzers: HTML (declarative API) + JS/TS (imperative API)
3. `packages/runtime` — Playwright-based harness that loads real pages with the WebMCP polyfill and inspects what actually registers
4. `packages/cli` — `webmcp-lint` with `text|json|sarif|github` reporters
5. `action/` — GitHub Action wrapper
6. Optional later: eslint-plugin-webmcp re-export of the JS rules

## Tech stack

- TypeScript, Node 20+
- **parse5** (or htmlparser2) for HTML; **ts-morph** for JS/TS
- **Playwright** + `@mcp-b/webmcp-polyfill` injected via init script for runtime checks (works headless without Chrome flags; add a `--chrome-native` mode using the `chrome://flags/#enable-webmcp-testing` path for spec-conformance runs)
- SARIF output so findings annotate PRs natively in GitHub

## Rule set (initial)

Severity: error / warn / info. Every rule gets an ID, doc page, and autofix flag where safe.

**Declarative (HTML) rules**
- `no-autosubmit-destructive` (error): `toolautosubmit` present on a form whose action/verb/name matches destructive patterns (/delete|remove|order|pay|purchase|checkout|transfer|cancel/i) or method implies mutation. Chrome's guidance: auto-submit only for read-only operations.
- `no-sensitive-inputs-exposed` (error): tool-annotated form contains `type=password`, `type=file`, or suspicious hidden inputs included in schema (auto-webmcp excludes these; hand-rolled annotations often don't).
- `require-tooldescription` (error) and `description-quality` (warn): missing/too-short/placeholder descriptions ("form", "submit").
- `named-inputs` (warn): inputs without `name` are silently dropped from the schema — flag likely mistakes (id-without-name).
- `unique-toolnames` (error) across scanned pages.

**Imperative (JS/TS) rules**
- `confirm-state-changing` (error): `registerTool`/`useMcpTool` whose handler performs mutations (POST/DELETE fetch, store writes) without a confirmation/`readOnlyHint:false` + gating pattern.
- `agent-rate-limit` (warn): submit/click handlers that branch on nothing when `event.agentInvoked` is available — i.e., no throttle path for agent-invoked calls. Heuristic: mutation handler reachable by a registered tool with no debounce/limit and no `agentInvoked` check.
- `schema-required` (error): `registerTool` without `inputSchema`; `schema-descriptions` (warn): schema properties lacking descriptions.
- `secure-context` (info): registration code paths that could run on http:// (modelContext is SecureContext-only — undefined off HTTPS).
- `registration-surface` (warn): direct hardcoding of `navigator.modelContext` vs `document.modelContext` without feature-detecting both (spec moved; polyfills differ). Verify current spec surface when implementing and keep this rule's guidance updated.
- `tool-count` (info): more than N (default 15) tools registered on one page — agents degrade with big tool menus.

**Runtime rules (Playwright)**
- `registers-cleanly`: page load produces expected tool list, no duplicate registrations (StrictMode double-mounting is a known footgun)
- `schema-validates`: for each tool, generate a minimal valid input from its schema, invoke via the polyfill's testing surface, assert no thrown schema errors; also send one *invalid* input and assert graceful failure (agents need actionable error messages)
- `no-side-effects-on-read`: invoke `readOnlyHint` tools and assert no non-GET network requests fired (Playwright request interception)
- `spa-lifecycle`: navigate between routes, assert tools unregister/re-register correctly (no orphans)

## Config

`webmcp-lint.config.ts`: rule levels, destructive-pattern overrides, page list or crawl entry, per-tool allowlist with justification comments (like eslint-disable but requiring a reason string).

## CLI

```
webmcp-lint static [globs]           # HTML+TS rules, no browser
webmcp-lint runtime --url http://localhost:3000 [--routes routes.json]
webmcp-lint ci                       # static + runtime, sarif + exit codes
```

Exit non-zero on any error-level finding. `--fix` only for mechanically safe fixes (adding `name` mirrors of `id`, removing `toolautosubmit`? No — removing behavior is not safe to autofix; emit a suggested patch instead).

## GitHub Action

- Inputs: build command, serve command/port, config path
- Uploads SARIF to code scanning; comments a summary table (tools found, errors, warns) on the PR

## Testing

- Rule unit tests: fixture HTML/TS snippets, table-driven (bad/good pairs per rule)
- Runtime tests against a fixture Next.js app that deliberately violates each rule
- Snapshot the SARIF output

## Risks / open questions

- Heuristic false positives on `confirm-state-changing` (mutations hidden behind abstraction layers). Mitigate: confidence levels, allowlist-with-reason, and start it at `warn` until precision is proven.
- Spec/behavior drift across Chrome versions (146 Canary → 149 origin trial → stable). Pin polyfill versions; keep a `spec-compat.md`; re-check Chrome's WebMCP docs at implementation time.
- Runtime harness needs the app running — keep `static` useful standalone so adoption is one command.

## Milestones

- M1: rule engine + 5 static rules + text/json reporters
- M2: Playwright runtime harness with polyfill injection, 3 runtime rules
- M3: SARIF + GitHub Action, docs site for rule IDs
- M4: dogfood on try-on app and one OSS WebMCP demo repo; publish
