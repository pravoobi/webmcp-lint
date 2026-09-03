import { describe, expect, it } from "vitest";
import { parseHtml } from "../src/index.js";

describe("parseHtml", () => {
  it("extracts a tool from an annotated form", () => {
    const { tools } = parseHtml(
      `<form toolname="search" tooldescription="Search the catalog" method="get" action="/search">
         <input name="q" type="text" />
         <button type="submit">Go</button>
       </form>`,
      "a.html",
    );
    expect(tools).toHaveLength(1);
    const [tool] = tools;
    expect(tool!.name).toBe("search");
    expect(tool!.description).toBe("Search the catalog");
    expect(tool!.method).toBe("get");
    expect(tool!.autosubmit).toBe(false);
    expect(tool!.inputs.map((i) => i.name)).toEqual(["q"]); // <button> is not collected
    expect(tool!.inputs[0]!.inSchema).toBe(true);
  });

  it("ignores plain forms without tool annotations", () => {
    const { tools } = parseHtml(`<form action="/x"><input name="a"></form>`, "b.html");
    expect(tools).toHaveLength(0);
  });

  it("treats toolautosubmit=\"false\" as not auto-submitting", () => {
    const { tools } = parseHtml(
      `<form toolname="t" toolautosubmit="false"><input name="a"></form>`,
      "c.html",
    );
    expect(tools[0]!.autosubmit).toBe(false);
  });

  it("treats a bare toolautosubmit attribute as auto-submitting", () => {
    const { tools } = parseHtml(
      `<form toolname="t" toolautosubmit><input name="a"></form>`,
      "c.html",
    );
    expect(tools[0]!.autosubmit).toBe(true);
  });

  it("records 1-based source locations", () => {
    const { tools } = parseHtml(
      `<html><body>\n  <form toolname="t"><input name="a"></form>\n</body></html>`,
      "d.html",
    );
    expect(tools[0]!.loc.line).toBe(2);
  });
});
