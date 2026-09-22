import { describe, expect, it } from "vitest";
import { parseJs } from "../src/index.js";

describe("parseJs: registerTool", () => {
  it("extracts name, description, schema, annotations, and an inline handler", () => {
    const { toolCalls } = parseJs(
      `document.modelContext.registerTool({
         name: "search",
         description: "Search things",
         inputSchema: {
           type: "object",
           properties: {
             q: { type: "string", description: "query" },
             limit: { type: "number" },
           },
         },
         annotations: { readOnlyHint: true, destructiveHint: false },
         execute: async ({ q }) => fetch("/x?q=" + q),
       });`,
      "a.ts",
    );
    expect(toolCalls).toHaveLength(1);
    const t = toolCalls[0]!;
    expect(t.api).toBe("registerTool");
    expect(t.argResolved).toBe(true);
    expect(t.name).toBe("search");
    expect(t.description).toBe("Search things");
    expect(t.hasInputSchema).toBe(true);
    expect(t.annotations).toEqual({ readOnlyHint: true, destructiveHint: false });
    expect(t.schemaProperties).toEqual([
      { name: "q", hasDescription: true, loc: expect.anything() },
      { name: "limit", hasDescription: false, loc: expect.anything() },
    ]);
    expect(t.handlerText).toContain("fetch");
  });

  it("matches registerTool regardless of the object chain in front of it", () => {
    const { toolCalls } = parseJs(`mc.registerTool({ name: "t" });`, "a.ts");
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("t");
  });

  it("marks argResolved false when the argument isn't an inline (or resolvable) object literal", () => {
    const { toolCalls } = parseJs(
      `document.modelContext.registerTool(buildToolDef());`,
      "a.ts",
    );
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.argResolved).toBe(false);
    expect(toolCalls[0]!.hasInputSchema).toBe(false);
  });

  it("resolves a same-file `const x = {...}` passed by reference", () => {
    const { toolCalls } = parseJs(
      `const def = { name: "t", inputSchema: { type: "object", properties: {} } };
       document.modelContext.registerTool(def);`,
      "a.ts",
    );
    expect(toolCalls[0]!.argResolved).toBe(true);
    expect(toolCalls[0]!.name).toBe("t");
    expect(toolCalls[0]!.hasInputSchema).toBe(true);
  });

  it("resolves a same-file named handler function passed by reference", () => {
    const { toolCalls } = parseJs(
      `function doIt({ id }) { return fetch("/x/" + id, { method: "DELETE" }); }
       document.modelContext.registerTool({ name: "t", execute: doIt });`,
      "a.ts",
    );
    expect(toolCalls[0]!.handlerText).toContain("DELETE");
  });
});

describe("parseJs: hook-style registration", () => {
  it("matches a hook whose name contains mcp", () => {
    const { toolCalls } = parseJs(`useWebMCP({ name: "t" });`, "a.tsx");
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.api).toBe("hook");
  });

  it("does not match an unrelated `use*` hook", () => {
    const { toolCalls } = parseJs(`useEffect(() => {}, []);`, "a.tsx");
    expect(toolCalls).toHaveLength(0);
  });

  it("parses JSX in a .tsx file without erroring", () => {
    const { toolCalls } = parseJs(
      `function App() { useWebMCP({ name: "t" }); return <div>hi</div>; }`,
      "a.tsx",
    );
    expect(toolCalls).toHaveLength(1);
  });
});

describe("parseJs: modelContextRefs", () => {
  it("collects a document.modelContext reference", () => {
    const { modelContextRefs } = parseJs(`const mc = document.modelContext;`, "a.ts");
    expect(modelContextRefs).toEqual([{ surface: "document", loc: expect.anything() }]);
  });

  it("collects both surfaces when a file feature-detects", () => {
    const { modelContextRefs } = parseJs(
      `const mc = document.modelContext ?? navigator.modelContext;`,
      "a.ts",
    );
    expect(modelContextRefs.map((r) => r.surface).sort()).toEqual(["document", "navigator"]);
  });
});
