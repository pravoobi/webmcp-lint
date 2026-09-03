import type { HtmlRule } from "../types.js";
import { noAutosubmitDestructive } from "./no-autosubmit-destructive.js";
import { noSensitiveInputsExposed } from "./no-sensitive-inputs-exposed.js";
import {
  descriptionQuality,
  requireTooldescription,
} from "./require-tooldescription.js";
import { namedInputs } from "./named-inputs.js";
import { uniqueToolnames } from "./unique-toolnames.js";

export const htmlRules: HtmlRule[] = [
  noAutosubmitDestructive,
  noSensitiveInputsExposed,
  requireTooldescription,
  descriptionQuality,
  namedInputs,
  uniqueToolnames,
];

export const htmlRulesById: Map<string, HtmlRule> = new Map(
  htmlRules.map((r) => [r.id, r]),
);

export {
  noAutosubmitDestructive,
  noSensitiveInputsExposed,
  requireTooldescription,
  descriptionQuality,
  namedInputs,
  uniqueToolnames,
};
