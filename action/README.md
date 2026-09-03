# webmcp-lint GitHub Action

Runs `webmcp-lint ci` (static HTML rules + optional Playwright runtime pass),
uploads the results to **GitHub code scanning** as SARIF, and posts a summary
table on pull requests.

## Usage

### Static only

```yaml
name: webmcp-lint
on: [push, pull_request]
permissions:
  contents: read
  security-events: write   # required for the SARIF upload
  pull-requests: write     # required for the PR comment
jobs:
  webmcp-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: webmcp-lint/webmcp-lint/action@v1
        with:
          static-globs: "public/**/*.html"
          no-runtime: "true"
```

### Static + runtime against a built site

```yaml
jobs:
  webmcp-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - uses: webmcp-lint/webmcp-lint/action@v1
        with:
          config: webmcp-lint.config.ts
          build-command: npm run build
          serve-command: npx serve -l 3000 dist
          serve-ready-url: http://localhost:3000
          url: |
            http://localhost:3000/
            http://localhost:3000/checkout
```

Or point it at a directory of static HTML and let the action serve it:

```yaml
      - uses: webmcp-lint/webmcp-lint/action@v1
        with:
          dir: dist
          routes: routes.json
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `version` | `latest` | npm version/tag of the `webmcp-lint` CLI |
| `config` | – | path to `webmcp-lint.config.*` |
| `static-globs` | `**/*.html` | globs for the static pass |
| `build-command` | – | build the site before checks |
| `serve-command` | – | serve the site (backgrounded) |
| `serve-ready-url` | – | URL polled until the server responds |
| `url` | – | page URLs for the runtime pass (newline/space separated) |
| `dir` | – | directory served on localhost for the runtime pass |
| `routes` | – | JSON array of extra routes per origin |
| `no-runtime` | `false` | static pass only |
| `upload-sarif` | `true` | upload to code scanning |
| `comment` | `true` | post/update a PR summary comment |
| `working-directory` | `.` | directory to run in |

## Outputs

| Output | Description |
|--------|-------------|
| `sarif-file` | path to the generated SARIF file |
| `errors` | number of error-level findings |

The job fails when any **error-level** finding is present (after the SARIF
upload and PR comment have run).
