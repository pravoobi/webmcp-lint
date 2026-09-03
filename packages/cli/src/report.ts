import { isAbsolute, relative } from "node:path";
import type { Finding, Severity } from "@webmcp-lint/rules";

export interface ReportInput {
  findings: Finding[];
  /** Free-form counts for machine formats, e.g. { files, tools } or { pages, tools }. */
  summary: Record<string, number>;
  /** Human scope line, e.g. "2 file(s), 5 tool(s) checked". */
  scope: string;
  errors: number;
  warnings: number;
  infos: number;
  cwd: string;
  version: string;
}

export type ReportFormat = "text" | "json" | "sarif" | "github";

export const REPORT_FORMATS: ReportFormat[] = ["text", "json", "sarif", "github"];

/** Repo-relative, forward-slashed path for a finding; URLs and already-relative paths pass through. */
export function displayPath(file: string, cwd: string): string {
  if (/^[a-z]+:\/\//i.test(file)) return file;
  const rel = isAbsolute(file) ? relative(cwd, file) || file : file;
  return rel.split("\\").join("/");
}

export function sarifLevel(sev: Severity): "error" | "warning" | "note" {
  return sev === "error" ? "error" : sev === "warn" ? "warning" : "note";
}

export function ghCommand(sev: Severity): "error" | "warning" | "notice" {
  return sev === "error" ? "error" : sev === "warn" ? "warning" : "notice";
}
