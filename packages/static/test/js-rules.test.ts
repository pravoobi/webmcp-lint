import { describe, expect, it } from "vitest";
import { analyzeJsSources } from "../src/index.js";

function ruleIds(source: string, file = "t.ts") {
  return analyzeJsSources([{ file, source }]).findings.map((f) => f.ruleId);
}

describe("schema-required", () => {
  it("flags a registerTool call with no inputSchema", () => {
    expect(ruleIds(`document.modelContext.registerTool({ name: "t" });`)).toContain(
      "schema-required",
    );
  });

  it("does not flag when inputSchema is present", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({ name: "t", inputSchema: { type: "object" } });`,
      ),
    ).not.toContain("schema-required");
  });

  it("does not flag an unresolved call (built by a helper)", () => {
    expect(ruleIds(`document.modelContext.registerTool(buildDef());`)).not.toContain(
      "schema-required",
    );
  });
});

describe("schema-descriptions", () => {
  it("flags a schema property with no description", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({
           name: "t",
           inputSchema: { type: "object", properties: { q: { type: "string" } } },
         });`,
      ),
    ).toContain("schema-descriptions");
  });

  it("does not flag when every property has a description", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({
           name: "t",
           inputSchema: {
             type: "object",
             properties: { q: { type: "string", description: "query" } },
           },
         });`,
      ),
    ).not.toContain("schema-descriptions");
  });
});

describe("confirm-state-changing", () => {
  const mutating = `document.modelContext.registerTool({
    name: "t",
    execute: async ({ id }) => fetch("/x/" + id, { method: "DELETE" }),
  });`;

  it("flags a mutating fetch with no confirmation gate", () => {
    const findings = analyzeJsSources([{ file: "t.ts", source: mutating }]).findings;
    const f = findings.find((x) => x.ruleId === "confirm-state-changing");
    expect(f).toBeTruthy();
    // Per the spec's own risk note: starts at warn, not error, until proven precise.
    expect(f!.severity).toBe("warn");
  });

  it("does not flag a read-only GET fetch", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({ name: "t", execute: () => fetch("/x") });`,
      ),
    ).not.toContain("confirm-state-changing");
  });

  it("does not flag when gated by an explicit confirm() call", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({
           name: "t",
           execute: async ({ id }) => {
             if (!confirm("Are you sure?")) return;
             return fetch("/x/" + id, { method: "DELETE" });
           },
         });`,
      ),
    ).not.toContain("confirm-state-changing");
  });

  it("does not flag when annotations.destructiveHint is true", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({
           name: "t",
           annotations: { destructiveHint: true },
           execute: async ({ id }) => fetch("/x/" + id, { method: "DELETE" }),
         });`,
      ),
    ).not.toContain("confirm-state-changing");
  });
});

describe("agent-rate-limit", () => {
  it("flags a mutating handler with no throttle and no agentInvoked check", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({
           name: "t",
           execute: async ({ id }) => fetch("/x/" + id, { method: "POST" }),
         });`,
      ),
    ).toContain("agent-rate-limit");
  });

  it("does not flag when the handler checks event.agentInvoked", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({
           name: "t",
           execute: async ({ id }, event) => {
             if (event.agentInvoked) return { ok: false };
             return fetch("/x/" + id, { method: "POST" });
           },
         });`,
      ),
    ).not.toContain("agent-rate-limit");
  });

  it("does not flag when the handler debounces", () => {
    expect(
      ruleIds(
        `document.modelContext.registerTool({
           name: "t",
           execute: debounce(async ({ id }) => fetch("/x/" + id, { method: "POST" }), 500),
         });`,
      ),
    ).not.toContain("agent-rate-limit");
  });
});

describe("secure-context", () => {
  it("flags a file that registers tools with no secure-context check", () => {
    expect(ruleIds(`document.modelContext.registerTool({ name: "t" });`)).toContain(
      "secure-context",
    );
  });

  it("does not flag when the file checks isSecureContext", () => {
    expect(
      ruleIds(
        `if (window.isSecureContext) {
           document.modelContext.registerTool({ name: "t" });
         }`,
      ),
    ).not.toContain("secure-context");
  });
});

describe("registration-surface", () => {
  it("flags a file that only ever references one surface", () => {
    expect(
      ruleIds(`const mc = document.modelContext; mc.registerTool({ name: "t" });`),
    ).toContain("registration-surface");
  });

  it("does not flag when the file feature-detects both surfaces", () => {
    expect(
      ruleIds(
        `const mc = document.modelContext ?? navigator.modelContext;
         mc.registerTool({ name: "t" });`,
      ),
    ).not.toContain("registration-surface");
  });
});

describe("tool-count", () => {
  it("flags when the number of registration call sites exceeds the configured max", () => {
    const source = Array.from(
      { length: 3 },
      (_, i) => `document.modelContext.registerTool({ name: "t${i}" });`,
    ).join("\n");
    const findings = analyzeJsSources([{ file: "t.ts", source }], { toolCountMax: 2 }).findings;
    expect(findings.some((f) => f.ruleId === "tool-count")).toBe(true);
  });

  it("does not flag at or under the threshold", () => {
    const source = Array.from(
      { length: 2 },
      (_, i) => `document.modelContext.registerTool({ name: "t${i}" });`,
    ).join("\n");
    const findings = analyzeJsSources([{ file: "t.ts", source }], { toolCountMax: 2 }).findings;
    expect(findings.some((f) => f.ruleId === "tool-count")).toBe(false);
  });
});

describe("config", () => {
  it("can disable a JS rule", () => {
    const findings = analyzeJsSources(
      [{ file: "t.ts", source: `document.modelContext.registerTool({ name: "t" });` }],
      { rules: { "schema-required": "off" } },
    ).findings;
    expect(findings.some((f) => f.ruleId === "schema-required")).toBe(false);
  });
});
