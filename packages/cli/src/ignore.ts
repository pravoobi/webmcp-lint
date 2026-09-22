/**
 * Which matched files `webmcp-lint static`/`ci` should skip: node_modules,
 * build output, VCS metadata, `.d.ts`, and test/spec files.
 *
 * Applied as a filter on *matched, absolute* paths rather than as
 * tinyglobby's `ignore` option — that option matches relative to `cwd`,
 * which silently stops excluding anything once a caller passes an absolute
 * glob (or one otherwise rooted outside `cwd`). Found by dogfooding this
 * exact case: `webmcp-lint static "/some/other/repo/**\/*.js"` from a
 * different cwd matched every file under that repo's node_modules too. A
 * path-segment/filename check is unambiguous regardless of how the
 * pattern was rooted.
 */
const IGNORED_DIR_RE = /[\\/](node_modules|dist|build|\.git)[\\/]/;
const IGNORED_FILE_RE = /\.d\.ts$|\.(test|spec)\.[^./\\]+$/;

export function isIgnoredPath(absPath: string): boolean {
  return IGNORED_DIR_RE.test(absPath) || IGNORED_FILE_RE.test(absPath);
}
