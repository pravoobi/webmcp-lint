import { createHash } from "node:crypto";
import { ruleCatalog } from "@pravoobi/webmcp-lint-rules";
import { displayPath, sarifLevel, type ReportInput } from "../report.js";

const SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";
const INFO_URI = "https://github.com/pravoobi/webmcp-lint";

function fingerprint(ruleId: string, uri: string, line: number, message: string): string {
  return createHash("sha256")
    .update(`${ruleId}\0${uri}\0${line}\0${message}`)
    .digest("hex")
    .slice(0, 16);
}

export function renderSarif(input: ReportInput): string {
  const rules = ruleCatalog.map((r) => ({
    id: r.id,
    name: r.id.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase()),
    shortDescription: { text: r.description },
    helpUri: r.docs,
    defaultConfiguration: { level: sarifLevel(r.defaultSeverity) },
    properties: { kind: r.kind, tags: ["webmcp", "agent-safety"] },
  }));
  const ruleIndex = new Map(rules.map((r, i) => [r.id, i]));

  const results = input.findings.map((f) => {
    const uri = displayPath(f.file, input.cwd);
    const region: Record<string, number> = { startLine: Math.max(1, f.loc.line) };
    if (f.loc.column) region["startColumn"] = f.loc.column;
    if (f.loc.endLine) region["endLine"] = f.loc.endLine;
    if (f.loc.endColumn) region["endColumn"] = f.loc.endColumn;

    const result: Record<string, unknown> = {
      ruleId: f.ruleId,
      level: sarifLevel(f.severity),
      message: { text: f.suggestion ? `${f.message}\n\nSuggested fix: ${f.suggestion}` : f.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri },
            region,
          },
        },
      ],
      partialFingerprints: {
        "webmcpLint/v1": fingerprint(f.ruleId, uri, f.loc.line, f.message),
      },
    };
    const idx = ruleIndex.get(f.ruleId);
    if (idx !== undefined) result["ruleIndex"] = idx;
    if (f.confidence) result["properties"] = { confidence: f.confidence };
    return result;
  });

  return JSON.stringify(
    {
      $schema: SCHEMA,
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "webmcp-lint",
              informationUri: INFO_URI,
              version: input.version,
              rules,
            },
          },
          results,
          properties: input.summary,
        },
      ],
    },
    null,
    2,
  );
}
