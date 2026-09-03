import type { ReportFormat, ReportInput } from "../report.js";
import { renderText } from "./text.js";
import { renderJson } from "./json.js";
import { renderSarif } from "./sarif.js";
import { renderGithub } from "./github.js";

export function render(format: ReportFormat, input: ReportInput): string {
  switch (format) {
    case "json":
      return renderJson(input);
    case "sarif":
      return renderSarif(input);
    case "github":
      return renderGithub(input);
    case "text":
    default:
      return renderText(input);
  }
}

export { renderText, renderJson, renderSarif, renderGithub };
