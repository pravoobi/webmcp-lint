/**
 * Shapes produced by the Playwright harness (`@webmcp-lint/runtime`) and consumed
 * by the pure runtime rules below. The harness does all the impure work — launching
 * a browser, injecting the polyfill, invoking tools — and hands the rules a plain
 * data record so they stay unit-testable.
 */
import type { RawFinding, Severity } from "../types.js";

export type ToolSource = "declarative" | "imperative" | "unknown";

export interface RuntimeToolInfo {
  name: string;
  description: string;
  inputSchema: unknown;
  /** Normalised annotations from `getTools()` (readOnlyHint, destructiveHint, …). */
  annotations: Record<string, unknown>;
  source: ToolSource;
  /** For declarative tools: the form's method (`get` | `post` | ""), lowercased. */
  formMethod?: string;
  /** For declarative tools: whether the form carries `toolautosubmit`. */
  autosubmit?: boolean;
}

export interface RegistrationAttempt {
  name: string | null;
  /** true = resolved, false = rejected, null = still pending when we sampled. */
  ok: boolean | null;
  error: string | null;
}

export type InvocationOutcome = "resolved" | "rejected" | "timeout" | "skipped";

export interface NetworkCall {
  method: string;
  url: string;
  resourceType?: string;
}

export interface ToolInvocation {
  tool: string;
  phase: "valid" | "invalid";
  input: unknown;
  outcome: InvocationOutcome;
  /** Present when outcome is "rejected". */
  error?: string;
  /** Present when outcome is "skipped". */
  skippedReason?: string;
  durationMs: number;
  /** Non-navigation network requests observed during the call window. */
  network: NetworkCall[];
}

export interface RuntimeObservation {
  url: string;
  loadOk: boolean;
  /** Populated when loadOk is false. */
  loadError?: string;
  tools: RuntimeToolInfo[];
  registrationAttempts: RegistrationAttempt[];
  consoleErrors: string[];
  pageErrors: string[];
  invocations: ToolInvocation[];
}

export interface RuntimeRuleContext {
  /** Reserved for future knobs (route lists, budgets). */
  readonly _reserved?: never;
}

export interface RuntimeRule {
  id: string;
  docs: string;
  defaultSeverity: Severity;
  fixable: boolean;
  description: string;
  check(observations: RuntimeObservation[], ctx: RuntimeRuleContext): RawFinding[];
}
