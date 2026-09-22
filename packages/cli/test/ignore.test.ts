import { describe, expect, it } from "vitest";
import { isIgnoredPath } from "../src/ignore.js";

describe("isIgnoredPath", () => {
  it("ignores node_modules, dist, build, and .git regardless of cwd/base", () => {
    expect(isIgnoredPath("/repo/node_modules/pkg/index.js")).toBe(true);
    expect(isIgnoredPath("/some/other/repo/dist/index.js")).toBe(true);
    expect(isIgnoredPath("/x/build/out.js")).toBe(true);
    expect(isIgnoredPath("/x/.git/hooks/pre-commit")).toBe(true);
  });

  it("ignores .d.ts and .test./.spec. files", () => {
    expect(isIgnoredPath("/repo/src/types.d.ts")).toBe(true);
    expect(isIgnoredPath("/repo/src/foo.test.js")).toBe(true);
    expect(isIgnoredPath("/repo/src/foo.spec.tsx")).toBe(true);
  });

  it("does not ignore ordinary source files", () => {
    expect(isIgnoredPath("/repo/src/tools.ts")).toBe(false);
    expect(isIgnoredPath("/repo/index.html")).toBe(false);
  });

  it("works on an absolute path rooted entirely outside any 'cwd' — the bug this fixes", () => {
    // tinyglobby's `ignore` option matches relative to `cwd`; passing an
    // absolute glob pointing outside cwd used to defeat it silently.
    expect(isIgnoredPath("/some/unrelated/repo/node_modules/pkg/index.js")).toBe(true);
    expect(isIgnoredPath("/some/unrelated/repo/src/webmcp-polyfill.test.js")).toBe(true);
  });

  it("handles Windows-style backslash paths too", () => {
    expect(isIgnoredPath("C:\\repo\\node_modules\\pkg\\index.js")).toBe(true);
    expect(isIgnoredPath("C:\\repo\\src\\tools.ts")).toBe(false);
  });
});
