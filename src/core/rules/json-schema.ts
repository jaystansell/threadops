/**
 * Lightweight JSON Schema Draft-7 validator for action parameter schemas.
 *
 * Supports: type, required, properties, enum, minimum, maximum,
 * minLength, maxLength, pattern, items, additionalProperties.
 * Enough for action parameter forms — not a full validator.
 */

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateJsonSchema(
  data: unknown,
  schema: Record<string, unknown>,
  path = "",
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!schema || typeof schema !== "object") {
    return { valid: true, errors: [] };
  }

  const schemaType = schema.type as string | undefined;

  // type check
  if (schemaType) {
    if (!checkType(data, schemaType)) {
      errors.push({ path: path || "(root)", message: `Expected type "${schemaType}"` });
      return { valid: false, errors };
    }
  }

  // enum
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      errors.push({
        path: path || "(root)",
        message: `Value must be one of: ${schema.enum.join(", ")}`,
      });
    }
  }

  // string constraints
  if (typeof data === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      errors.push({ path: path || "(root)", message: `String too short (min ${schema.minLength})` });
    }
    if (typeof schema.maxLength === "number" && data.length > schema.maxLength) {
      errors.push({ path: path || "(root)", message: `String too long (max ${schema.maxLength})` });
    }
    if (typeof schema.pattern === "string") {
      const re = new RegExp(schema.pattern);
      if (!re.test(data)) {
        errors.push({ path: path || "(root)", message: `Does not match pattern "${schema.pattern}"` });
      }
    }
  }

  // number constraints
  if (typeof data === "number") {
    if (typeof schema.minimum === "number" && data < schema.minimum) {
      errors.push({ path: path || "(root)", message: `Must be >= ${schema.minimum}` });
    }
    if (typeof schema.maximum === "number" && data > schema.maximum) {
      errors.push({ path: path || "(root)", message: `Must be <= ${schema.maximum}` });
    }
  }

  // object constraints
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = schema.required as string[] | undefined;

    if (required) {
      for (const key of required) {
        if (!(key in obj)) {
          errors.push({ path: joinPath(path, key), message: "Required" });
        }
      }
    }

    if (properties) {
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in obj) {
          const sub = validateJsonSchema(obj[key], propSchema, joinPath(path, key));
          errors.push(...sub.errors);
        }
      }
    }

    if (schema.additionalProperties === false && properties) {
      const allowed = new Set(Object.keys(properties));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) {
          errors.push({ path: joinPath(path, key), message: "Additional property not allowed" });
        }
      }
    }
  }

  // array constraints
  if (Array.isArray(data) && schema.items) {
    const itemSchema = schema.items as Record<string, unknown>;
    for (let i = 0; i < data.length; i++) {
      const sub = validateJsonSchema(data[i], itemSchema, `${path}[${i}]`);
      errors.push(...sub.errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkType(value: unknown, expected: string): boolean {
  switch (expected) {
    case "string":
      return typeof value === "string";
    case "number":
    case "integer":
      return typeof value === "number" && (expected === "number" || Number.isInteger(value));
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

function joinPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}
