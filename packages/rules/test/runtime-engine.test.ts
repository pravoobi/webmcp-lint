import { describe, expect, it } from "vitest";
import {
  runRuntimeRules,
  runtimeRulesById,
  type RuntimeObservation,
} from "../src/runtime/index.js";

function obs(partial: Partial<RuntimeObservation>): RuntimeObservation {
  return {
    url: "http://localhost/t.html",
    loadOk: true,
    tools: [],
    // A registered tool by default, so the unrelated "no tools registered"
    // catch-all doesn't also fire and pollute these console-error-focused tests.
    registrationAttempts: [{ name: "some_tool", ok: true, error: null }],
    consoleErrors: [],
    pageErrors: [],
    invocations: [],
    ...partial,
  };
}

const registersCleanly = runtimeRulesById.get("registers-cleanly")!;

describe("registers-cleanly console-error matching", () => {
  it("ignores unrelated console.error noise (accelerator/codec registries)", () => {
    const findings = runRuntimeRules(
      [
        obs({
          consoleErrors: [
            "INFO: [accelerator_registry.cc:54] RegisterAccelerator: ptr=0xc3980, name=WebNN",
            "WARNING: [npu_registry.cc:34] NPU accelerator could not be loaded and registered: kLiteRtStatusErrorInvalidArgument.",
            "INFO: [webnn_registry.cc:35] Statically linked WebNN accelerator registered.",
          ],
        }),
      ],
      { rules: [registersCleanly] },
    );
    expect(findings).toEqual([]);
  });

  it("still flags a console.error that is actually about tool registration", () => {
    const findings = runRuntimeRules(
      [obs({ consoleErrors: ["Uncaught: tool registration failed, invalid schema"] })],
      { rules: [registersCleanly] },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("registers-cleanly");
  });

  it("also matches bare modelContext/webmcp mentions", () => {
    const findings = runRuntimeRules(
      [obs({ consoleErrors: ["TypeError: window.modelContext is undefined"] })],
      { rules: [registersCleanly] },
    );
    expect(findings).toHaveLength(1);
  });
});

describe("registers-cleanly severity wiring", () => {
  it("downgrades the console-error heuristic to warn by default (never fails CI alone)", () => {
    const findings = runRuntimeRules(
      [obs({ consoleErrors: ["tool registration threw: SchemaError"] })],
      { rules: [registersCleanly] },
    );
    expect(findings[0]!.severity).toBe("warn");
  });

  it("keeps structural findings (duplicate registration) at the rule's default: error", () => {
    const findings = runRuntimeRules(
      [
        obs({
          registrationAttempts: [
            { name: "search", ok: true, error: null },
            { name: "search", ok: false, error: "already registered" },
          ],
        }),
      ],
      { rules: [registersCleanly] },
    );
    const dup = findings.find((f) => f.message.includes("registered 2 times"));
    expect(dup?.severity).toBe("error");
    // False positive from dogfooding a non-React demo (vanilla JS + a
    // hand-rolled polyfill) that still hit this path: the message used to
    // flatly assert "this is usually React StrictMode" regardless of
    // framework. It can still name StrictMode as the common case, but must
    // not claim it's the cause outright.
    expect(dup?.message).not.toMatch(/usually React StrictMode/);
    expect(dup?.message).toMatch(/duplicate init path|any .* can do it/i);
  });

  it("an explicit config override still wins over the finding's own severity", () => {
    const findings = runRuntimeRules(
      [obs({ consoleErrors: ["tool registration threw: SchemaError"] })],
      { rules: [registersCleanly], config: { rules: { "registers-cleanly": "error" } } },
    );
    expect(findings[0]!.severity).toBe("error");
  });
});
