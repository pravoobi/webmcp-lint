import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import {
  runRuntimeRules,
  type Finding,
  type RuntimeObservation,
} from "@pravoobi/webmcp-lint-rules";
import { observeUrls } from "../src/browser.js";
import { serveDir } from "../src/server.js";
import { invalidSample, validSample } from "../src/sample.js";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const FILES = ["clean.html", "strict-mode.html", "read-side-effect.html", "bad-schema.html"];

let hasBrowser = false;
try {
  hasBrowser = existsSync(chromium.executablePath());
} catch {
  hasBrowser = false;
}
const suite = hasBrowser ? describe : describe.skip;

suite("runtime harness", () => {
  const byFile = new Map<string, RuntimeObservation>();
  let findings: Finding[] = [];

  beforeAll(async () => {
    const server = await serveDir(FIXTURES);
    try {
      const obs = await observeUrls(
        FILES.map((f) => server.url + f),
        { timeoutMs: 8000, settleMs: 400 },
      );
      for (const o of obs) byFile.set(o.url.split("/").pop()!, o);
      findings = runRuntimeRules(obs);
    } finally {
      await server.close();
    }
  }, 120_000);

  it("loads every fixture and registers its tool", () => {
    for (const f of FILES) {
      const o = byFile.get(f)!;
      expect(o.loadOk, `${f} loadOk`).toBe(true);
      expect(o.tools.length, `${f} tool count`).toBeGreaterThanOrEqual(1);
    }
  });

  it("clean.html produces no findings", () => {
    expect(findings.filter((x) => x.file.endsWith("clean.html"))).toEqual([]);
  });

  it("registers-cleanly flags the StrictMode double registration", () => {
    const o = byFile.get("strict-mode.html")!;
    expect(o.registrationAttempts).toHaveLength(2);
    expect(o.registrationAttempts[1]!.ok).toBe(false);
    const f = findings.find(
      (x) => x.ruleId === "registers-cleanly" && x.file.endsWith("strict-mode.html"),
    );
    expect(f?.message).toMatch(/registered 2 times/);
  });

  it("no-side-effects-on-read flags a POST from a readOnly tool", () => {
    const f = findings.find(
      (x) =>
        x.ruleId === "no-side-effects-on-read" &&
        x.file.endsWith("read-side-effect.html"),
    );
    expect(f, "expected a no-side-effects-on-read finding").toBeTruthy();
    expect(f!.severity).toBe("error");
    expect(f!.message).toMatch(/POST/);
  });

  it("schema-validates flags a tool that throws on valid input", () => {
    const f = findings.find(
      (x) => x.ruleId === "schema-validates" && x.file.endsWith("bad-schema.html"),
    );
    expect(f?.message).toMatch(/rejected a schema-valid input/);
  });

  it("bad-schema is the only file that trips schema-validates", () => {
    const files = new Set(
      findings.filter((x) => x.ruleId === "schema-validates").map((x) => x.file),
    );
    expect([...files].every((u) => u.endsWith("bad-schema.html"))).toBe(true);
  });
});

describe("schema samples", () => {
  it("builds a valid sample honoring required + types", () => {
    const sample = validSample({
      type: "object",
      properties: { q: { type: "string" }, n: { type: "number" } },
      required: ["q", "n"],
    }) as Record<string, unknown>;
    expect(typeof sample.q).toBe("string");
    expect(typeof sample.n).toBe("number");
  });

  it("omits the first required property for the invalid sample", () => {
    const sample = invalidSample({
      type: "object",
      properties: { q: { type: "string" }, n: { type: "number" } },
      required: ["q", "n"],
    }) as Record<string, unknown>;
    expect("q" in sample).toBe(false);
    expect("n" in sample).toBe(true);
  });

  it("respects enum and const", () => {
    expect(validSample({ enum: ["a", "b"] })).toBe("a");
    expect(validSample({ const: 42 })).toBe(42);
  });
});
