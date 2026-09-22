import type { JsRule, RawFinding } from "../types.js";
import { toolLabel } from "./util.js";

export const schemaRequired: JsRule = {
  id: "schema-required",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/schema-required.md",
  defaultSeverity: "error",
  fixable: false,
  description: "Require every imperatively-registered tool to declare an `inputSchema`.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.toolCalls) {
        // Only flag a confirmed absence — an unresolved call (built by a
        // helper, imported) is "unknown", not "missing".
        if (!tool.argResolved || tool.hasInputSchema) continue;
        out.push({
          ruleId: "schema-required",
          file: parse.file,
          loc: tool.loc,
          confidence: "high",
          message:
            `Tool ${toolLabel(tool)} has no \`inputSchema\`. Agents rely on it to know what ` +
            "arguments a tool accepts; without one, invocation is a guess.",
          suggestion: "Add an `inputSchema` (JSON Schema object) describing the tool's parameters.",
        });
      }
    }
    return out;
  },
};

export const schemaDescriptions: JsRule = {
  id: "schema-descriptions",
  docs: "https://github.com/pravoobi/webmcp-lint/blob/main/docs/rules/schema-descriptions.md",
  defaultSeverity: "warn",
  fixable: false,
  description: "Flag `inputSchema` properties with no `description`.",
  check(parses) {
    const out: RawFinding[] = [];
    for (const parse of parses) {
      for (const tool of parse.toolCalls) {
        if (!tool.schemaProperties) continue;
        for (const prop of tool.schemaProperties) {
          if (prop.hasDescription) continue;
          out.push({
            ruleId: "schema-descriptions",
            file: parse.file,
            loc: prop.loc,
            confidence: "high",
            message:
              `Schema property "${prop.name}" on tool ${toolLabel(tool)} has no \`description\`. ` +
              "An agent has to guess what value to pass.",
            suggestion: `Add a \`description\` to the "${prop.name}" schema property.`,
          });
        }
      }
    }
    return out;
  },
};
