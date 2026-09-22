import { describe, expect, it } from "vitest";
import type { Finding } from "@pravoobi/webmcp-lint-rules";
import type { ReportInput } from "../src/report.js";
import { renderSarif } from "../src/reporters/sarif.js";
import { renderJson } from "../src/reporters/json.js";
import { renderGithub } from "../src/reporters/github.js";

const CWD = "/repo";

function finding(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: "no-autosubmit-destructive",
    severity: "error",
    message: "Tool \"placeOrder\" sets `toolautosubmit` on a POST form.",
    file: "/repo/src/checkout.html",
    loc: { file: "/repo/src/checkout.html", line: 6, column: 5, endLine: 6, endColumn: 40 },
    fixable: false,
    docs: "https://example.com/docs/no-autosubmit-destructive",
    suggestion: "Remove the `toolautosubmit` attribute.",
    confidence: "high",
    ...over,
  };
}

const input: ReportInput = {
  findings: [
    finding(),
    finding({
      ruleId: "description-quality",
      severity: "warn",
      message: 'Tool "placeOrder" description is a placeholder ("tool").',
      loc: { file: "/repo/src/checkout.html", line: 15, column: 5 },
      suggestion: undefined,
      confidence: "medium",
    }),
    finding({
      ruleId: "registers-cleanly",
      message: 'Tool "add_todo" was registered 2 times on one page load.',
      file: "site/index.html",
      loc: { file: "site/index.html", line: 1, column: 1 },
      suggestion: undefined,
      confidence: undefined,
    }),
  ],
  summary: { files: 1, tools: 3 },
  scope: "1 file(s), 3 tool(s) checked",
  errors: 2,
  warnings: 1,
  infos: 0,
  cwd: CWD,
  version: "0.0.0-test",
};

describe("renderSarif", () => {
  it("matches the snapshot", () => {
    expect(renderSarif(input)).toMatchSnapshot();
  });

  it("maps severities and normalises paths", () => {
    const sarif = JSON.parse(renderSarif(input));
    const run = sarif.runs[0];
    expect(sarif.version).toBe("2.1.0");
    expect(run.results.map((r: any) => r.level)).toEqual(["error", "warning", "error"]);
    expect(run.results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(
      "src/checkout.html",
    );
    // every result references a known rule
    for (const r of run.results) {
      expect(typeof r.ruleIndex).toBe("number");
      expect(run.tool.driver.rules[r.ruleIndex].id).toBe(r.ruleId);
    }
  });

  it("produces stable fingerprints", () => {
    const a = JSON.parse(renderSarif(input));
    const b = JSON.parse(renderSarif(input));
    expect(a.runs[0].results[0].partialFingerprints).toEqual(
      b.runs[0].results[0].partialFingerprints,
    );
  });
});

describe("renderJson", () => {
  it("includes normalised path and merged counts", () => {
    const out = JSON.parse(renderJson(input));
    expect(out.summary).toMatchObject({ files: 1, tools: 3, errors: 2, warnings: 1 });
    expect(out.findings[0].path).toBe("src/checkout.html");
  });
});

describe("renderGithub", () => {
  it("emits workflow commands with escaped newlines", () => {
    const table = renderGithub(input); // annotations go to stdout, table returned
    expect(table).toContain("| Rule | Errors | Warnings | Info |");
    expect(table).toContain("`no-autosubmit-destructive`");
  });
});
