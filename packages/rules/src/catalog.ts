import type { Severity } from "./types.js";
import { htmlRules } from "./rules/index.js";
import { runtimeRules } from "./runtime/rules/index.js";

export interface RuleMeta {
  id: string;
  kind: "html" | "runtime";
  defaultSeverity: Severity;
  fixable: boolean;
  description: string;
  docs: string;
}

/** Every built-in rule, static + runtime, in a uniform shape for reporters/docs. */
export const ruleCatalog: RuleMeta[] = [
  ...htmlRules.map(
    (r): RuleMeta => ({
      id: r.id,
      kind: "html",
      defaultSeverity: r.defaultSeverity,
      fixable: r.fixable,
      description: r.description,
      docs: r.docs,
    }),
  ),
  ...runtimeRules.map(
    (r): RuleMeta => ({
      id: r.id,
      kind: "runtime",
      defaultSeverity: r.defaultSeverity,
      fixable: r.fixable,
      description: r.description,
      docs: r.docs,
    }),
  ),
];

export const ruleCatalogById: Map<string, RuleMeta> = new Map(
  ruleCatalog.map((r) => [r.id, r]),
);
