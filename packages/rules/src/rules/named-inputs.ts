import type { HtmlRule, RawFinding } from "../types.js";
import { toolLabel } from "./util.js";

const NON_DATA_TYPES = new Set(["submit", "button", "reset", "image"]);

export const namedInputs: HtmlRule = {
  id: "named-inputs",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/named-inputs.md",
  defaultSeverity: "warn",
  fixable: true,
  description:
    "Flag tool form controls without a `name` (silently dropped from the schema).",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.tools) {
        for (const input of tool.inputs) {
          if (input.name != null && input.name !== "") continue;
          if (input.tag === "input" && NON_DATA_TYPES.has(input.type)) continue;

          if (input.id != null && input.id !== "") {
            out.push({
              ruleId: "named-inputs",
              file: parse.file,
              loc: input.loc,
              confidence: "high",
              message:
                `<${input.tag} id="${input.id}"> in tool ${toolLabel(tool)} has no ` +
                "`name`, so it is dropped from the generated tool schema.",
              suggestion: `Add name="${input.id}" to mirror the id.`,
            });
          } else {
            out.push({
              ruleId: "named-inputs",
              file: parse.file,
              loc: input.loc,
              confidence: "medium",
              message:
                `<${input.tag}> in tool ${toolLabel(tool)} has no \`name\` and is ` +
                "dropped from the generated tool schema.",
              suggestion: "Add a `name` attribute if this field should be agent-fillable.",
            });
          }
        }
      }
    }
    return out;
  },
};
