import { chromium, type Browser, type Page } from "playwright";
import type {
  NetworkCall,
  RegistrationAttempt,
  RuntimeObservation,
  RuntimeToolInfo,
  ToolInvocation,
} from "@pravoobi/webmcp-lint-rules";
import { polyfillInitScript } from "./polyfill.js";
import { INSTRUMENT_SCRIPT } from "./instrument.js";
import { invalidSample, validSample } from "./sample.js";

export interface HarnessOptions {
  headless?: boolean;
  /** Per-navigation and per-invocation timeout. */
  timeoutMs?: number;
  /** Idle wait after load / after each invocation, for async work to settle. */
  settleMs?: number;
  /** Path override for the polyfill IIFE bundle. */
  polyfillPath?: string;
}

const DEFAULTS = { headless: true, timeoutMs: 15_000, settleMs: 400 };

interface ResolvedOptions {
  headless: boolean;
  timeoutMs: number;
  settleMs: number;
  polyfillPath?: string;
}

interface RawNet {
  method: string;
  url: string;
  resourceType: string;
  index: number;
}

export async function observeUrls(
  urls: string[],
  options: HarnessOptions = {},
): Promise<RuntimeObservation[]> {
  const opts = { ...DEFAULTS, ...options };
  const browser = await chromium.launch({ headless: opts.headless });
  try {
    const results: RuntimeObservation[] = [];
    for (const url of urls) {
      results.push(await observeOne(browser, url, opts));
    }
    return results;
  } finally {
    await browser.close();
  }
}

async function observeOne(
  browser: Browser,
  url: string,
  opts: ResolvedOptions,
): Promise<RuntimeObservation> {
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const net: RawNet[] = [];

  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => {
    net.push({
      method: r.method(),
      url: r.url(),
      resourceType: r.resourceType(),
      index: net.length,
    });
  });

  await page.addInitScript({ content: polyfillInitScript(opts.polyfillPath) });
  await page.addInitScript({ content: INSTRUMENT_SCRIPT });

  let loadOk = true;
  let loadError: string | undefined;
  try {
    await page.goto(url, { waitUntil: "load", timeout: opts.timeoutMs });
    await page.waitForTimeout(opts.settleMs);
  } catch (err) {
    loadOk = false;
    loadError = err instanceof Error ? err.message : String(err);
  }

  let tools: RuntimeToolInfo[] = [];
  let registrationAttempts: RegistrationAttempt[] = [];

  if (loadOk) {
    try {
      const raw = await page.evaluate(readModelContext);
      registrationAttempts = raw.attempts;
      const declarative = await page.evaluate(readDeclarativeForms);
      tools = raw.tools.map((t) => {
        const d = declarative[t.name];
        return {
          ...t,
          source: d ? ("declarative" as const) : ("imperative" as const),
          ...(d ? { formMethod: d.method, autosubmit: d.autosubmit } : {}),
        };
      });
    } catch (err) {
      pageErrors.push(`harness: failed to read modelContext: ${String(err)}`);
    }
  }

  const invocations: ToolInvocation[] = [];
  if (loadOk) {
    for (const tool of tools) {
      invocations.push(
        ...(await invokeTool(page, tool, net, opts)),
      );
    }
  }

  await context.close();

  return {
    url,
    loadOk,
    ...(loadError ? { loadError } : {}),
    tools,
    registrationAttempts,
    consoleErrors,
    pageErrors,
    invocations,
  };
}

async function invokeTool(
  page: Page,
  tool: RuntimeToolInfo,
  net: RawNet[],
  opts: ResolvedOptions,
): Promise<ToolInvocation[]> {
  const phases: { phase: "valid" | "invalid"; input: unknown }[] = [
    { phase: "valid", input: validSample(tool.inputSchema) },
    { phase: "invalid", input: invalidSample(tool.inputSchema) },
  ];

  const out: ToolInvocation[] = [];
  for (const { phase, input } of phases) {
    if (tool.source === "declarative" && tool.autosubmit !== true) {
      out.push({
        tool: tool.name,
        phase,
        input,
        outcome: "skipped",
        skippedReason: "declarative form without toolautosubmit needs a user submit",
        durationMs: 0,
        network: [],
      });
      continue;
    }

    const startIndex = net.length;
    let res: InPageResult;
    try {
      res = await page.evaluate(execInPage, {
        name: tool.name,
        inputJson: JSON.stringify(input),
        timeoutMs: opts.timeoutMs,
      });
    } catch (err) {
      res = { outcome: "rejected", error: `harness: ${String(err)}`, ms: 0 };
    }
    await page.waitForTimeout(opts.settleMs);

    const network: NetworkCall[] = net
      .slice(startIndex)
      .filter((n) => n.resourceType !== "document")
      .map((n) => ({ method: n.method, url: n.url, resourceType: n.resourceType }));

    out.push({
      tool: tool.name,
      phase,
      input,
      outcome: res.outcome,
      ...(res.error ? { error: res.error } : {}),
      durationMs: Math.round(res.ms),
      network,
    });
  }
  return out;
}

/* ---------- functions evaluated inside the page ---------- */

interface InPageResult {
  outcome: "resolved" | "rejected" | "timeout" | "skipped";
  value?: unknown;
  error?: string;
  ms: number;
}

function readModelContext(): {
  tools: Omit<RuntimeToolInfo, "source">[];
  attempts: RegistrationAttempt[];
} {
  const mc: any = (document as any).modelContext || (navigator as any).modelContext;
  const store: any = (window as any).__WEBMCP_LINT__ || { attempts: [] };
  const attempts: RegistrationAttempt[] = (store.attempts || []).map((a: any) => ({
    name: a.name ?? null,
    ok: a.ok ?? null,
    error: a.error ?? null,
  }));
  if (!mc || typeof mc.getTools !== "function") return { tools: [], attempts };

  return mc.getTools().then((list: any[]) => ({
    attempts,
    tools: list.map((t) => ({
      name: String(t.name),
      description: String(t.description ?? ""),
      inputSchema: t.inputSchema ?? null,
      annotations: (t.annotations ?? {}) as Record<string, unknown>,
    })),
  })) as any;
}

function readDeclarativeForms(): Record<string, { method: string; autosubmit: boolean }> {
  const out: Record<string, { method: string; autosubmit: boolean }> = {};
  const forms = document.querySelectorAll(
    "form[toolname], form[tool-name], form[data-tool-name]",
  );
  forms.forEach((f) => {
    const name =
      f.getAttribute("toolname") ||
      f.getAttribute("tool-name") ||
      f.getAttribute("data-tool-name");
    if (!name) return;
    const autosubmitAttr =
      f.getAttribute("toolautosubmit") ??
      f.getAttribute("tool-autosubmit") ??
      f.getAttribute("data-tool-autosubmit");
    const autosubmit =
      autosubmitAttr !== null &&
      !["false", "0", "no", "off"].includes(autosubmitAttr.trim().toLowerCase());
    out[name] = {
      method: (f.getAttribute("method") || "").toLowerCase(),
      autosubmit,
    };
  });
  return out;
}

function execInPage(args: {
  name: string;
  inputJson: string;
  timeoutMs: number;
}): Promise<InPageResult> {
  const mc: any = (document as any).modelContext || (navigator as any).modelContext;
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const done = (r: Omit<InPageResult, "ms">): InPageResult => ({
    ...r,
    ms: (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
  });

  if (!mc || typeof mc.getTools !== "function") {
    return Promise.resolve(done({ outcome: "skipped", error: "no modelContext" }));
  }

  return mc.getTools().then((list: any[]) => {
    const tool = list.find((x) => x.name === args.name);
    if (!tool) return done({ outcome: "rejected", error: "tool not found in getTools()" });

    let call: Promise<unknown>;
    if (typeof mc.executeTool === "function") {
      call = Promise.resolve(mc.executeTool(tool, args.inputJson));
    } else if ((navigator as any).modelContextTesting?.executeTool) {
      call = Promise.resolve(
        (navigator as any).modelContextTesting.executeTool(args.name, args.inputJson),
      );
    } else {
      return done({ outcome: "skipped", error: "no executeTool surface" });
    }

    const timeout = new Promise<{ __timeout: true }>((r) =>
      setTimeout(() => r({ __timeout: true }), args.timeoutMs),
    );

    return Promise.race([call.then((v) => ({ __value: v })), timeout]).then(
      (r: any) => {
        if (r && r.__timeout) return done({ outcome: "timeout" });
        let value = r.__value;
        if (typeof value === "string") {
          try {
            value = JSON.parse(value);
          } catch {
            /* keep string */
          }
        }
        return done({ outcome: "resolved", value });
      },
      (err: any) =>
        done({ outcome: "rejected", error: String((err && err.message) || err) }),
    );
  });
}
