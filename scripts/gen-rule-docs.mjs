// Regenerates docs/rules/README.md from the built rule catalog.
// Usage: node scripts/gen-rule-docs.mjs
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const catalogUrl = new URL("../packages/rules/dist/catalog.js", import.meta.url);
if (!existsSync(fileURLToPath(catalogUrl))) {
  console.error("build @webmcp-lint/rules first: pnpm --filter @webmcp-lint/rules build");
  process.exit(1);
}
const { ruleCatalog } = await import(catalogUrl.href);

const rows = ruleCatalog
  .map((r) => {
    const name = `\`${r.id}\``;
    const link = `[${name}](./${r.id}.md)`;
    return `| ${link} | ${r.kind} | ${r.defaultSeverity} | ${r.fixable ? "yes" : "—"} | ${r.description} |`;
  })
  .join("\n");

const body = `# webmcp-lint rules

Generated from the rule catalog — do not edit by hand
(\`node scripts/gen-rule-docs.mjs\`).

| Rule | Kind | Default | Fixable | Summary |
|------|------|---------|---------|---------|
${rows}

## Configuring

Set a level per rule in \`webmcp-lint.config.*\`:

\`\`\`ts
export default {
  rules: {
    "description-quality": "off",     // "error" | "warn" | "info" | "off"
    "schema-validates": "error",
  },
};
\`\`\`

- **html** rules run in \`webmcp-lint static\` (parse5, no browser).
- **runtime** rules run in \`webmcp-lint runtime\` (Playwright + the WebMCP polyfill).
- \`webmcp-lint ci\` runs both.
`;

writeFileSync(new URL("../docs/rules/README.md", import.meta.url), body);
console.log(`wrote docs/rules/README.md (${ruleCatalog.length} rules)`);
