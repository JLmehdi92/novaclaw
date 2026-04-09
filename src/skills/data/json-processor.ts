// src/skills/data/json-processor.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

/**
 * Resolve a dot/bracket path like "data.users[0].name" against an object.
 */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      throw new SkillError(`Path "${path}" not found at segment "${part}"`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export class JsonProcessorSkill extends BaseSkill {
  name = "json-processor";
  description =
    "Parse, transform, validate and query JSON data. Supports path extraction, filtering, pretty-print and minify.";
  category = "data";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["parse", "extract", "filter", "validate", "pretty", "minify", "keys", "transform"],
        description:
          "Action: parse (validate & summarize), extract (get value at path), filter (filter array), validate (check against schema), pretty (format), minify (compact), keys (list top-level keys), transform (map array fields)",
      },
      json: {
        type: "string",
        description: "JSON string to process",
      },
      path: {
        type: "string",
        description:
          "Dot-notation path for extract, e.g. 'data.users[0].name'",
      },
      filter_key: {
        type: "string",
        description: "Key to filter on (used with action=filter)",
      },
      filter_value: {
        type: "string",
        description:
          "Value to match for filter_key. Supports prefix operators: '>' / '<' for numbers.",
      },
      schema: {
        type: "string",
        description:
          "Simple JSON schema as a JSON string: { required: [], types: { field: 'string|number|boolean|object|array' } }",
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Fields to pick when action=transform",
      },
    },
    required: ["action", "json"],
  };

  async execute(args: Record<string, unknown>, _context: SkillContext): Promise<string> {
    const action = args.action as string;
    const jsonStr = args.json as string;

    logger.info(`[JsonProcessor] action=${action}`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new SkillError(`Invalid JSON: ${(e as Error).message}`);
    }

    switch (action) {
      case "parse":
        return this.summarize(parsed);

      case "extract": {
        const path = args.path as string;
        if (!path) throw new SkillError("path is required for action=extract");
        const value = getByPath(parsed, path);
        return JSON.stringify(value, null, 2);
      }

      case "filter": {
        if (!Array.isArray(parsed)) {
          throw new SkillError("JSON must be an array for action=filter");
        }
        const filterKey = args.filter_key as string;
        const filterValue = args.filter_value as string;
        if (!filterKey) throw new SkillError("filter_key is required for action=filter");
        if (filterValue === undefined || filterValue === null) {
          throw new SkillError("filter_value is required for action=filter");
        }
        return JSON.stringify(this.filterArray(parsed, filterKey, filterValue), null, 2);
      }

      case "validate": {
        const schemaStr = args.schema as string;
        if (!schemaStr) throw new SkillError("schema is required for action=validate");
        let schema: unknown;
        try {
          schema = JSON.parse(schemaStr);
        } catch (e) {
          throw new SkillError(`Invalid schema JSON: ${(e as Error).message}`);
        }
        return this.validate(parsed, schema as Record<string, unknown>);
      }

      case "pretty":
        return JSON.stringify(parsed, null, 2);

      case "minify":
        return JSON.stringify(parsed);

      case "keys": {
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new SkillError("JSON must be an object for action=keys");
        }
        const keys = Object.keys(parsed as Record<string, unknown>);
        return `Top-level keys (${keys.length}):\n${keys.map((k) => `  - ${k}`).join("\n")}`;
      }

      case "transform": {
        if (!Array.isArray(parsed)) {
          throw new SkillError("JSON must be an array for action=transform");
        }
        const fields = args.fields as string[] | undefined;
        if (!fields || fields.length === 0) {
          throw new SkillError("fields is required for action=transform");
        }
        const transformed = (parsed as Record<string, unknown>[]).map((item) => {
          const out: Record<string, unknown> = {};
          for (const f of fields) {
            out[f] = item[f];
          }
          return out;
        });
        return JSON.stringify(transformed, null, 2);
      }

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private summarize(data: unknown): string {
    const lines: string[] = ["JSON parsed successfully."];
    if (Array.isArray(data)) {
      lines.push(`Type: array`);
      lines.push(`Length: ${data.length}`);
      if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
        lines.push(`Item keys: ${Object.keys(data[0] as Record<string, unknown>).join(", ")}`);
      }
    } else if (typeof data === "object" && data !== null) {
      const keys = Object.keys(data as Record<string, unknown>);
      lines.push(`Type: object`);
      lines.push(`Keys (${keys.length}): ${keys.join(", ")}`);
    } else {
      lines.push(`Type: ${typeof data}`);
      lines.push(`Value: ${JSON.stringify(data)}`);
    }
    return lines.join("\n");
  }

  private filterArray(
    arr: unknown[],
    key: string,
    filterValue: string
  ): unknown[] {
    const gtMatch = filterValue.match(/^>(.+)$/);
    const ltMatch = filterValue.match(/^<(.+)$/);

    return arr.filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const val = (item as Record<string, unknown>)[key];
      if (gtMatch) return Number(val) > Number(gtMatch[1]);
      if (ltMatch) return Number(val) < Number(ltMatch[1]);
      // Loose equality (string comparison)
      return String(val) === filterValue;
    });
  }

  private validate(data: unknown, schema: Record<string, unknown>): string {
    const errors: string[] = [];
    const required = (schema.required as string[]) || [];
    const types = (schema.types as Record<string, string>) || {};

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return "Validation failed: root must be an object";
    }

    const obj = data as Record<string, unknown>;

    for (const field of required) {
      if (!(field in obj)) {
        errors.push(`Missing required field: "${field}"`);
      }
    }

    for (const [field, expectedType] of Object.entries(types)) {
      if (field in obj) {
        const actual = Array.isArray(obj[field]) ? "array" : typeof obj[field];
        if (actual !== expectedType) {
          errors.push(`Field "${field}": expected ${expectedType}, got ${actual}`);
        }
      }
    }

    if (errors.length === 0) return "Validation passed.";
    return `Validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
  }
}
