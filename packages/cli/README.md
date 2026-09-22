# webmcp-lint

A CI linter + runtime test harness that checks a site's **WebMCP** tools against
Chrome's guidance and general agent-safety rules — the "eslint + axe-core of
agent-readiness".

WebMCP has real safety footguns: auto-submitting a "place order" form, exposing
password/hidden inputs to an agent, letting agents hammer a mutation at machine
speed. Chrome documents the guidance; nothing enforces it in CI. This does.

## Install

```bash
npm i -D webmcp-lint
# runtime pass also needs Playwright browsers:
npx playwright install chromium
```

## Use

```bash
webmcp-lint static "**/*.html"          # declarative-HTML static analysis
webmcp-lint runtime http://localhost:3000   # load with the real polyfill, inspect tools
webmcp-lint ci --sarif-output results.sarif # both passes, CI exit codes + SARIF
webmcp-lint rules                        # list built-in rule IDs
```

Reporters: `text`, `json`, `sarif`, `github`. `--output` / `--sarif-output` write
to files.

## GitHub Action

```yaml
- uses: pravoobi/webmcp-lint/action@v1
  with:
    static-globs: "dist/**/*.html"
    build-command: npm run build
```

Full docs and rule reference: https://github.com/pravoobi/webmcp-lint

## License

MIT
