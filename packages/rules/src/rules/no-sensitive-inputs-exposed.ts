import type { HtmlRule, RawFinding } from "../types.js";
import { toolLabel } from "./util.js";

export const noSensitiveInputsExposed: HtmlRule = {
  id: "no-sensitive-inputs-exposed",
  docs: "https://github.com/webmcp-lint/webmcp-lint/blob/main/docs/rules/no-sensitive-inputs-exposed.md",
  defaultSeverity: "error",
  fixable: false,
  description:
    "Disallow password/file/hidden inputs from appearing in a tool's input schema.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.tools) {
        for (const input of tool.inputs) {
          if (!input.inSchema) continue;

          let kind: string | null = null;
          let advice = "";
          if (input.type === "password") {
            kind = "a password input";
            advice =
              "Never let an agent populate credentials. Exclude it from the tool " +
              "or collect it outside the agent flow.";
          } else if (input.type === "file") {
            kind = "a file input";
            advice =
              "File uploads cannot be meaningfully driven by an agent and may leak " +
              "local paths. Exclude it from the tool.";
          } else if (input.hidden) {
            kind = `a hidden input (${input.name})`;
            advice =
              "Agents can set hidden fields to arbitrary values. auto-webmcp " +
              "excludes hidden inputs; keep this value server-side or drop it from the schema.";
          }
          if (kind == null) continue;

          out.push({
            ruleId: "no-sensitive-inputs-exposed",
            file: parse.file,
            loc: input.loc,
            confidence: input.hidden ? "medium" : "high",
            message:
              `Tool ${toolLabel(tool)} exposes ${kind} in its input schema. ${advice}`,
          });
        }
      }
    }
    return out;
  },
};
