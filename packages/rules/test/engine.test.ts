import { describe, expect, it } from "vitest";
import {
  countBySeverity,
  resolveConfig,
  runHtmlRules,
  type HtmlFileParse,
  type HtmlTool,
} from "../src/index.js";

function tool(partial: Partial<HtmlTool>): HtmlTool {
  return {
    name: "t",
    description: "A perfectly adequate description of the tool",
    autosubmit: false,
    method: "get",
    action: "",
    formName: null,
    inputs: [],
    loc: { file: "t.html", line: 1, column: 1 },
    ...partial,
  };
}

function parse(tools: HtmlTool[]): HtmlFileParse {
  return { file: "t.html", source: "", tools };
}

describe("resolveConfig", () => {
  it("merges extra destructive patterns", () => {
    expect(resolveConfig({ destructivePatterns: ["frob"] }).destructiveRegex.test("frob")).toBe(
      true,
    );
    expect(resolveConfig().destructiveRegex.test("delete")).toBe(true);
  });

  it("can replace the default patterns entirely", () => {
    const re = resolveConfig({ destructivePatternsReplace: ["onlythis"] }).destructiveRegex;
    expect(re.test("delete")).toBe(false);
    expect(re.test("ONLYTHIS")).toBe(true);
  });
});

describe("runHtmlRules", () => {
  it("applies per-rule severity overrides from config", () => {
    const parses = [parse([tool({ description: null })])];
    const findings = runHtmlRules(parses, {
      config: { rules: { "require-tooldescription": "warn" } },
    });
    const f = findings.find((x) => x.ruleId === "require-tooldescription");
    expect(f?.severity).toBe("warn");
  });

  it("skips rules set to off", () => {
    const parses = [parse([tool({ description: null })])];
    const findings = runHtmlRules(parses, {
      config: { rules: { "require-tooldescription": "off" } },
    });
    expect(findings.some((x) => x.ruleId === "require-tooldescription")).toBe(false);
  });

  it("returns findings sorted by file then position", () => {
    const parses = [
      {
        file: "b.html",
        source: "",
        tools: [tool({ description: null, loc: { file: "b.html", line: 1, column: 1 } })],
      },
      {
        file: "a.html",
        source: "",
        tools: [tool({ description: null, loc: { file: "a.html", line: 9, column: 1 } })],
      },
    ];
    const files = runHtmlRules(parses).map((f) => f.file);
    expect(files[0]).toBe("a.html");
  });

  it("counts by severity", () => {
    const parses = [parse([tool({ description: null, name: "x" }), tool({ description: "form", name: "y" })])];
    const counts = countBySeverity(runHtmlRules(parses));
    expect(counts.error).toBeGreaterThanOrEqual(1);
    expect(counts.warn).toBeGreaterThanOrEqual(1);
  });
});
