import type { HtmlRule, RawFinding } from "../types.js";
import { normalizeDescription, toolLabel } from "./util.js";

const PLACEHOLDERS = new Set([
  "form",
  "submit",
  "tool",
  "button",
  "click",
  "click here",
  "todo",
  "tbd",
  "description",
  "test",
  "n/a",
]);

const MIN_LENGTH = 12;

export const requireTooldescription: HtmlRule = {
  id: "require-tooldescription",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/require-tooldescription.md",
  defaultSeverity: "error",
  fixable: false,
  description: "Require every declarative tool to carry a `tooldescription`.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.tools) {
        if (normalizeDescription(tool.description).length > 0) continue;
        out.push({
          ruleId: "require-tooldescription",
          file: parse.file,
          loc: tool.loc,
          confidence: "high",
          message:
            `Tool ${toolLabel(tool)} has no \`tooldescription\`. Agents rely on it ` +
            "to decide when to call the tool.",
          suggestion:
            'Add tooldescription="…" describing what the tool does and when an agent should use it.',
        });
      }
    }
    return out;
  },
};

export const descriptionQuality: HtmlRule = {
  id: "description-quality",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/description-quality.md",
  defaultSeverity: "warn",
  fixable: false,
  description:
    "Flag placeholder or too-short `tooldescription` values.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.tools) {
        const desc = normalizeDescription(tool.description);
        if (desc.length === 0) continue; // handled by require-tooldescription

        const isPlaceholder = PLACEHOLDERS.has(desc.toLowerCase());
        const isShort = desc.length < MIN_LENGTH;
        if (!isPlaceholder && !isShort) continue;

        out.push({
          ruleId: "description-quality",
          file: parse.file,
          loc: tool.loc,
          confidence: isPlaceholder ? "high" : "medium",
          message:
            `Tool ${toolLabel(tool)} description ${
              isPlaceholder ? `is a placeholder ("${desc}")` : `is very short ("${desc}")`
            }. Write a full sentence describing the action and when an agent should use it.`,
        });
      }
    }
    return out;
  },
};
