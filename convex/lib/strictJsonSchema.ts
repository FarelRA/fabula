/**
 * OpenAI-style strict structured outputs reject any object schema whose
 * `properties` contains a key that `required` does not list. Zod marks
 * `.optional()` keys by omitting them from `required`, so provider schemas
 * built from zod need a rewrite: every object requires all of its keys, and a
 * key that zod marks optional becomes nullable. `stripOptionalNulls` undoes
 * the null marker before zod validation, so a null from the model reads back
 * as an absent optional key.
 *
 * Free-form records (`additionalProperties` carrying a schema) cannot be
 * expressed under strict mode; `isStrictCompatible` flags them so the gateway
 * can fall back to non-strict JSON output for those calls.
 */

type JsonObject = Record<string, unknown>;

/** Sentinel for "drop this key" while cleaning optional nulls. */
const ABSENT = Symbol("absent");

const SCHEMA_VALUE_KEYS = [
  "items",
  "additionalProperties",
  "not",
  "if",
  "then",
  "else",
  "contains",
  "propertyNames",
] as const;

const SCHEMA_LIST_KEYS = ["anyOf", "oneOf", "allOf", "prefixItems"] as const;

const SCHEMA_MAP_KEYS = ["$defs", "definitions", "properties", "patternProperties"] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rewrites a zod JSON Schema into the shape strict structured outputs accept. */
export function toStrictJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictJsonSchema);
  if (!isObject(schema)) return schema;
  const out: JsonObject = { ...schema };
  for (const key of SCHEMA_VALUE_KEYS) {
    if (isObject(out[key]) || Array.isArray(out[key])) {
      out[key] = toStrictJsonSchema(out[key]);
    }
  }
  for (const key of SCHEMA_LIST_KEYS) {
    if (Array.isArray(out[key])) {
      out[key] = (out[key] as unknown[]).map(toStrictJsonSchema);
    }
  }
  for (const key of SCHEMA_MAP_KEYS) {
    const map = out[key];
    if (isObject(map)) {
      out[key] = Object.fromEntries(
        Object.entries(map).map(([name, value]) => [name, toStrictJsonSchema(value)]),
      );
    }
  }
  if (isObject(out.properties)) {
    const required = new Set(
      (Array.isArray(out.required) ? out.required : []).filter(
        (key): key is string => typeof key === "string",
      ),
    );
    const properties = out.properties;
    out.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        required.has(key) ? value : allowNull(value),
      ]),
    );
    out.required = Object.keys(properties);
    out.additionalProperties = false;
  }
  return out;
}

function allowNull(schema: unknown): unknown {
  if (
    isObject(schema) &&
    typeof schema.type === "string" &&
    schema.enum === undefined &&
    schema.const === undefined
  ) {
    return { ...schema, type: [schema.type, "null"] };
  }
  return { anyOf: [schema, { type: "null" }] };
}

/**
 * Removes the nulls the strict rewrite made possible before zod validation, so
 * an optional key that the model answered with null reads back as absent.
 * Values the schema does not mark nullable pass through untouched.
 */
export function stripOptionalNulls(schema: unknown, value: unknown): unknown {
  const cleaned = cleanValue(schema, value);
  return cleaned === ABSENT ? value : cleaned;
}

function cleanValue(schema: unknown, value: unknown): unknown {
  if (!isObject(schema)) return value;
  if (value === null) return allowsNull(schema) ? ABSENT : value;
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf.filter(
      (branch) => !(isObject(branch) && branch.type === "null"),
    );
    if (branches.length === 1) return cleanValue(branches[0], value);
    const matching = branches.find((branch) => matchesType(branch, value));
    return matching === undefined ? value : cleanValue(matching, value);
  }
  if (Array.isArray(value)) {
    const items = schema.items;
    if (!isObject(items)) return value;
    return value.map((entry) => {
      const cleaned = cleanValue(items, entry);
      return cleaned === ABSENT ? null : cleaned;
    });
  }
  if (isObject(value)) {
    const properties = schema.properties;
    if (!isObject(properties)) return value;
    const out: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      const propertySchema = properties[key];
      const cleaned = propertySchema === undefined ? entry : cleanValue(propertySchema, entry);
      if (cleaned !== ABSENT) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

function allowsNull(schema: JsonObject): boolean {
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  return (
    Array.isArray(schema.anyOf) &&
    schema.anyOf.some((branch) => isObject(branch) && branch.type === "null")
  );
}

function matchesType(schema: unknown, value: unknown): boolean {
  if (!isObject(schema)) return false;
  switch (schema.type) {
    case "object":
      return isObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
}

/** True when every object in the schema can satisfy strict structured outputs. */
export function isStrictCompatible(schema: unknown): boolean {
  if (Array.isArray(schema)) return schema.every(isStrictCompatible);
  if (!isObject(schema)) return true;
  const additional = schema.additionalProperties;
  if (additional !== undefined && additional !== false) return false;
  return Object.values(schema).every((entry) => isStrictCompatible(entry));
}
