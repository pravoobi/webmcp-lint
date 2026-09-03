/**
 * Tiny JSON-Schema sample generator. Not a full implementation — just enough to
 * exercise a tool with a plausible valid input and a deliberately invalid one.
 */

interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema | Schema[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  format?: string;
  minimum?: number;
  minLength?: number;
}

function pickType(schema: Schema): string {
  if (Array.isArray(schema.type)) return schema.type[0] ?? "string";
  if (typeof schema.type === "string") return schema.type;
  if (schema.properties || schema.required) return "object";
  if (schema.items) return "array";
  return "string";
}

/** A minimal value that should satisfy `schema`. */
export function validSample(schema: unknown): unknown {
  const s = (schema ?? {}) as Schema;
  if ("const" in s) return s.const;
  if (s.default !== undefined) return s.default;
  if (s.enum && s.enum.length > 0) return s.enum[0];

  switch (pickType(s)) {
    case "object": {
      const out: Record<string, unknown> = {};
      const props = s.properties ?? {};
      const required = s.required ?? Object.keys(props);
      for (const key of required) {
        out[key] = validSample(props[key] ?? {});
      }
      return out;
    }
    case "array": {
      const item = Array.isArray(s.items) ? s.items[0] : s.items;
      return item ? [validSample(item)] : [];
    }
    case "number":
    case "integer":
      return typeof s.minimum === "number" ? s.minimum : 1;
    case "boolean":
      return false;
    case "null":
      return null;
    default: {
      if (s.format === "email") return "test@example.com";
      if (s.format === "uri" || s.format === "url") return "https://example.com";
      const base = "test";
      return typeof s.minLength === "number" && s.minLength > base.length
        ? base.padEnd(s.minLength, "x")
        : base;
    }
  }
}

/**
 * A value that should NOT satisfy `schema`. For an object with required
 * properties we omit the first required one (the strongest, most portable signal
 * that nothing is enforcing the contract); otherwise we send a wrong-typed value.
 */
export function invalidSample(schema: unknown): unknown {
  const s = (schema ?? {}) as Schema;
  const type = pickType(s);

  if (type === "object") {
    const props = s.properties ?? {};
    const required = s.required ?? [];
    if (required.length > 0) {
      const omit = required[0]!;
      const out: Record<string, unknown> = {};
      for (const k of required) {
        if (k !== omit) out[k] = validSample(props[k] ?? {});
      }
      return out;
    }
    return "not-an-object";
  }

  if (type === "array") return "not-an-array";
  if (type === "number" || type === "integer") return "not-a-number";
  if (type === "boolean") return "not-a-boolean";
  if (s.enum && s.enum.length > 0) return "__definitely_not_in_enum__";
  return 42; // string expected, give a number
}
