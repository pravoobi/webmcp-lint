# registers-cleanly (runtime)

**Severity:** error · **Fixable:** no

## Rationale

When an agent opens a page it reads `document.modelContext.getTools()` once. If
registration is flaky — the same tool registered twice, a registration that
rejects, an uncaught error during load — the agent sees a broken or inconsistent
tool list.

## What it flags

Per page load:

- **Duplicate registration** of the same tool name. The polyfill rejects the
  second `registerTool`, so `getTools()` looks fine but the code is buggy. The
  usual cause is React StrictMode / double-mounting a component that registers in
  an effect without cleanup.
- A registration promise that **rejected** (`already registered`, invalid
  descriptor, non-serializable schema).
- A registration that **never settled** by the time the harness sampled.
- **Uncaught errors** on the page during load, and tool-related console errors.
- **No tools at all** when the page also made no registration attempts — often
  means the registration code isn't running (wrong API surface, `http://`
  context, build problem).

## Fix

Register each tool once and tie its lifetime to an `AbortSignal`:

```js
useEffect(() => {
  const ac = new AbortController();
  document.modelContext.registerTool(def, { signal: ac.signal });
  return () => ac.abort();
}, []);
```
