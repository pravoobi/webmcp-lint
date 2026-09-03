/**
 * Injected as an init script *after* the polyfill. Records every
 * `registerTool` call (name, resolve/reject) on `window.__WEBMCP_LINT__` so the
 * harness can detect duplicate / failed registrations that `getTools()` alone
 * would hide (the polyfill rejects a duplicate rather than listing it twice).
 */
export const INSTRUMENT_SCRIPT = String.raw`
(() => {
  var w = window;
  var store = { attempts: [], toolchanges: 0 };
  w.__WEBMCP_LINT__ = store;

  function wrap(target) {
    if (!target || typeof target.registerTool !== "function" || target.__webmcpLintWrapped) return false;
    var original = target.registerTool;
    function wrapped(def, opts) {
      var name = def && typeof def === "object" ? (def.name != null ? String(def.name) : null) : null;
      var rec = { name: name, ok: null, error: null };
      store.attempts.push(rec);
      var result;
      try {
        result = original.call(this, def, opts);
      } catch (err) {
        rec.ok = false;
        rec.error = String((err && err.message) || err);
        throw err;
      }
      return Promise.resolve(result).then(
        function (v) { rec.ok = true; return v; },
        function (err) { rec.ok = false; rec.error = String((err && err.message) || err); throw err; }
      );
    }
    try {
      Object.defineProperty(target, "registerTool", {
        value: wrapped, writable: true, configurable: true, enumerable: false,
      });
      Object.defineProperty(target, "__webmcpLintWrapped", {
        value: true, writable: false, configurable: true, enumerable: false,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  var mc = document.modelContext || (navigator && navigator.modelContext);
  if (mc) {
    if (!wrap(mc)) wrap(Object.getPrototypeOf(mc));
    try {
      if (typeof mc.addEventListener === "function") {
        mc.addEventListener("toolchange", function () { store.toolchanges++; });
      }
    } catch (e) {}
  }
})();
`;
