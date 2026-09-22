import { describe, expect, it } from "vitest";
import { analyzeHtmlSources } from "../src/index.js";

function ruleIds(html: string): string[] {
  return analyzeHtmlSources([{ file: "t.html", source: html }])
    .findings.map((f) => f.ruleId);
}

describe("no-autosubmit-destructive", () => {
  it("flags toolautosubmit on a POST form", () => {
    expect(
      ruleIds(
        `<form toolname="save" tooldescription="Save the profile changes" method="post" action="/profile" toolautosubmit><input name="bio"></form>`,
      ),
    ).toContain("no-autosubmit-destructive");
  });

  it("flags toolautosubmit when the action looks destructive", () => {
    expect(
      ruleIds(
        `<form toolname="rm" tooldescription="Delete the current account" action="/account/delete" toolautosubmit><input name="id"></form>`,
      ),
    ).toContain("no-autosubmit-destructive");
  });

  it("allows toolautosubmit on a read-only GET form", () => {
    expect(
      ruleIds(
        `<form toolname="search" tooldescription="Search the product catalog" method="get" action="/search" toolautosubmit><input name="q"></form>`,
      ),
    ).not.toContain("no-autosubmit-destructive");
  });

  it("does not flag a GET lookup whose name contains a destructive noun (get_order_status)", () => {
    // Real false positive from dogfooding googlechromelabs/webmcp-tools:
    // "order" is a destructive pattern, but this is plainly a read.
    expect(
      ruleIds(
        `<form toolname="get_order_status" tooldescription="Search orders and return shipping status" method="get" action="history.html" toolautosubmit><input name="timeframe"></form>`,
      ),
    ).not.toContain("no-autosubmit-destructive");
  });

  it("mutating-method matches stay at the rule default (error); name-only matches are capped at warn", () => {
    const { findings: mutating } = analyzeHtmlSources([
      {
        file: "t.html",
        source: `<form toolname="save" tooldescription="Save the profile changes" method="post" action="/profile" toolautosubmit><input name="bio"></form>`,
      },
    ]);
    expect(mutating.find((f) => f.ruleId === "no-autosubmit-destructive")?.severity).toBe(
      "error",
    );

    const { findings: nameOnly } = analyzeHtmlSources([
      {
        file: "t.html",
        source: `<form toolname="rm" tooldescription="Delete the current account" action="/account/delete" toolautosubmit><input name="id"></form>`,
      },
    ]);
    expect(nameOnly.find((f) => f.ruleId === "no-autosubmit-destructive")?.severity).toBe(
      "warn",
    );
  });
});

describe("no-sensitive-inputs-exposed", () => {
  it("flags a password input in a tool form", () => {
    expect(
      ruleIds(
        `<form toolname="login" tooldescription="Sign the user in to their account"><input name="user"><input name="pass" type="password"></form>`,
      ),
    ).toContain("no-sensitive-inputs-exposed");
  });

  it("flags a named hidden input", () => {
    expect(
      ruleIds(
        `<form toolname="t" tooldescription="Do a thing the agent might want"><input name="csrf" type="hidden" value="x"><input name="a"></form>`,
      ),
    ).toContain("no-sensitive-inputs-exposed");
  });

  it("does not flag a normal text input", () => {
    expect(
      ruleIds(
        `<form toolname="t" tooldescription="Do a thing the agent might want"><input name="a"></form>`,
      ),
    ).not.toContain("no-sensitive-inputs-exposed");
  });
});

describe("require-tooldescription / description-quality", () => {
  it("flags a missing description", () => {
    expect(ruleIds(`<form toolname="t"><input name="a"></form>`)).toContain(
      "require-tooldescription",
    );
  });

  it("flags a placeholder description", () => {
    expect(
      ruleIds(`<form toolname="t" tooldescription="form"><input name="a"></form>`),
    ).toContain("description-quality");
  });

  it("accepts a real description", () => {
    const ids = ruleIds(
      `<form toolname="t" tooldescription="Add the selected item to the shopping cart"><input name="a"></form>`,
    );
    expect(ids).not.toContain("require-tooldescription");
    expect(ids).not.toContain("description-quality");
  });
});

describe("named-inputs", () => {
  it("flags an input with id but no name", () => {
    expect(
      ruleIds(
        `<form toolname="t" tooldescription="Do a thing the agent might want"><input id="email"></form>`,
      ),
    ).toContain("named-inputs");
  });

  it("does not flag a submit button without a name", () => {
    expect(
      ruleIds(
        `<form toolname="t" tooldescription="Do a thing the agent might want"><input name="a"><button type="submit">Go</button></form>`,
      ),
    ).not.toContain("named-inputs");
  });
});

describe("unique-toolnames", () => {
  it("flags a name used on two pages, but only as a warn (ambiguous — WebMCP scopes tools per page)", () => {
    const { findings } = analyzeHtmlSources([
      {
        file: "a.html",
        source: `<form toolname="dup" tooldescription="Do the first thing an agent wants"><input name="a"></form>`,
      },
      {
        file: "b.html",
        source: `<form toolname="dup" tooldescription="Do the second thing an agent wants"><input name="a"></form>`,
      },
    ]);
    const dupes = findings.filter((f) => f.ruleId === "unique-toolnames");
    expect(dupes).toHaveLength(2);
    expect(dupes.every((f) => f.severity === "warn")).toBe(true);
  });

  it("flags a name used twice in the same page as a certain error", () => {
    const { findings } = analyzeHtmlSources([
      {
        file: "a.html",
        source:
          `<form toolname="dup" tooldescription="Do the first thing an agent wants"><input name="a"></form>` +
          `<form toolname="dup" tooldescription="Do a second, different thing"><input name="b"></form>`,
      },
    ]);
    const dupes = findings.filter((f) => f.ruleId === "unique-toolnames");
    expect(dupes).toHaveLength(2);
    expect(dupes.every((f) => f.severity === "error")).toBe(true);
  });
});

describe("config", () => {
  it("can disable a rule", () => {
    const { findings } = analyzeHtmlSources(
      [{ file: "t.html", source: `<form toolname="t"><input name="a"></form>` }],
      { rules: { "require-tooldescription": "off" } },
    );
    expect(findings.map((f) => f.ruleId)).not.toContain("require-tooldescription");
  });

  it("honors extra destructive patterns", () => {
    const html = `<form toolname="frobnicate" tooldescription="Frobnicate the widget thoroughly" method="get" action="/frob" toolautosubmit><input name="a"></form>`;
    expect(
      analyzeHtmlSources([{ file: "t.html", source: html }], {
        destructivePatterns: ["frob"],
      }).findings.map((f) => f.ruleId),
    ).toContain("no-autosubmit-destructive");
  });
});
