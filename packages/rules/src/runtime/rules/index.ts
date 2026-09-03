import type { RuntimeRule } from "../types.js";
import { registersCleanly } from "./registers-cleanly.js";
import { schemaValidates } from "./schema-validates.js";
import { noSideEffectsOnRead } from "./no-side-effects-on-read.js";

export const runtimeRules: RuntimeRule[] = [
  registersCleanly,
  schemaValidates,
  noSideEffectsOnRead,
];

export const runtimeRulesById: Map<string, RuntimeRule> = new Map(
  runtimeRules.map((r) => [r.id, r]),
);

export { registersCleanly, schemaValidates, noSideEffectsOnRead };
