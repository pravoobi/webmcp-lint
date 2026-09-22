import type { JsRule } from "../types.js";
import { confirmStateChanging } from "./confirm-state-changing.js";
import { agentRateLimit } from "./agent-rate-limit.js";
import { schemaRequired, schemaDescriptions } from "./schema-required.js";
import { secureContext } from "./secure-context.js";
import { registrationSurface } from "./registration-surface.js";
import { toolCount } from "./tool-count.js";

export const jsRules: JsRule[] = [
  confirmStateChanging,
  agentRateLimit,
  schemaRequired,
  schemaDescriptions,
  secureContext,
  registrationSurface,
  toolCount,
];

export const jsRulesById: Map<string, JsRule> = new Map(jsRules.map((r) => [r.id, r]));

export {
  confirmStateChanging,
  agentRateLimit,
  schemaRequired,
  schemaDescriptions,
  secureContext,
  registrationSurface,
  toolCount,
};
