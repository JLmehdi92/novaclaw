// src/skills/data/csv-processor.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

function parseCsv(csvStr: string, delimiter = ","): CsvTable {
  const lines = csvStr.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new SkillError("CSV is empty");

  const headers = splitLine(lines[0], delimiter);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function toCsv(headers: string[], rows: Record<string, string>[], delimiter = ","): string {
  const escape = (v: string) => (v.includes(delimiter) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const header = headers.map(escape).join(delimiter);
  const body = rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(delimiter));
  return [header, ...body].join("\n");
}

export class CsvProcessorSkill extends BaseSkill {
  name = "csv-processor";
  description =
    "Parse, filter, sort, aggregate and convert CSV data. Handles headers, quoting, and common delimiters.";
  category = "data";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["parse", "filter", "select", "sort", "aggregate", "to_json", "to_csv"],
        description:
          "Action: parse (summary), filter (rows by value), select (pick columns), sort (by column), aggregate (count/sum/avg), to_json (CSV→JSON), to_csv (JSON array→CSV)",
      },
      csv: {
        type: "string",
        description: "CSV string to process (for actions that take CSV input)",
      },
      json: {
        type: "string",
        description: "JSON array string to convert to CSV (for action=to_csv)",
      },
      delimiter: {
        type: "string",
        description: "Column delimiter character (default: ',')",
      },
      filter_column: {
        type: "string",
        description: "Column name to filter on",
      },
      filter_value: {
        type: "string",
        description: "Value to match. Supports '>' / '<' prefix for numeric comparison.",
      },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Column names to select (action=select)",
      },
      sort_column: {
        type: "string",
        description: "Column to sort by",
      },
      sort_order: {
        type: "string",
        enum: ["asc", "desc"],
        description: "Sort direction (default: asc)",
      },
      agg_column: {
        type: "string",
        description: "Column to aggregate on",
      },
      agg_function: {
        type: "string",
        enum: ["count", "sum", "average", "min", "max"],
        description: "Aggregation function",
      },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, _context: SkillContext): Promise<string> {
    const action = args.action as string;
    const delimiter = (args.delimiter as string) || ",";

    logger.info(`[CsvProcessor] action=${action}`);

    // CSV input actions
    const csvActions = ["parse", "filter", "select", "sort", "aggregate", "to_json"];
    if (csvActions.includes(action)) {
      const csvStr = args.csv as string;
      if (!csvStr) throw new SkillError("csv is required for this action");
      const table = parseCsv(csvStr, delimiter);

      switch (action) {
        case "parse":
          return this.summarize(table);

        case "filter": {
          const col = args.filter_column as string;
          const val = args.filter_value as string;
          if (!col) throw new SkillError("filter_column is required");
          if (val === undefined || val === null) throw new SkillError("filter_value is required");
          if (!table.headers.includes(col)) {
            throw new SkillError(`Column "${col}" not found. Available: ${table.headers.join(", ")}`);
          }
          const filtered = this.filterRows(table.rows, col, val);
          return toCsv(table.headers, filtered, delimiter);
        }

        case "select": {
          const cols = args.columns as string[];
          if (!cols || cols.length === 0) throw new SkillError("columns is required");
          const missing = cols.filter((c) => !table.headers.includes(c));
          if (missing.length > 0) {
            throw new SkillError(`Unknown columns: ${missing.join(", ")}. Available: ${table.headers.join(", ")}`);
          }
          return toCsv(cols, table.rows, delimiter);
        }

        case "sort": {
          const col = args.sort_column as string;
          if (!col) throw new SkillError("sort_column is required");
          if (!table.headers.includes(col)) {
            throw new SkillError(`Column "${col}" not found. Available: ${table.headers.join(", ")}`);
          }
          const order = (args.sort_order as string) || "asc";
          const sorted = [...table.rows].sort((a, b) => {
            const av = a[col] ?? "";
            const bv = b[col] ?? "";
            const na = Number(av);
            const nb = Number(bv);
            const compare = !isNaN(na) && !isNaN(nb) ? na - nb : av.localeCompare(bv);
            return order === "desc" ? -compare : compare;
          });
          return toCsv(table.headers, sorted, delimiter);
        }

        case "aggregate": {
          const col = args.agg_column as string;
          const fn = args.agg_function as string;
          if (!col) throw new SkillError("agg_column is required");
          if (!fn) throw new SkillError("agg_function is required");
          if (!table.headers.includes(col)) {
            throw new SkillError(`Column "${col}" not found. Available: ${table.headers.join(", ")}`);
          }
          return this.aggregate(table.rows, col, fn);
        }

        case "to_json":
          return JSON.stringify(table.rows, null, 2);

        default:
          throw new SkillError(`Unknown action: ${action}`);
      }
    }

    if (action === "to_csv") {
      const jsonStr = args.json as string;
      if (!jsonStr) throw new SkillError("json is required for action=to_csv");
      let arr: unknown;
      try {
        arr = JSON.parse(jsonStr);
      } catch (e) {
        throw new SkillError(`Invalid JSON: ${(e as Error).message}`);
      }
      if (!Array.isArray(arr)) throw new SkillError("JSON must be an array of objects");
      if (arr.length === 0) return "";
      const headers = Object.keys(arr[0] as Record<string, unknown>);
      const rows = (arr as Record<string, unknown>[]).map((item) => {
        const row: Record<string, string> = {};
        for (const h of headers) {
          row[h] = String(item[h] ?? "");
        }
        return row;
      });
      return toCsv(headers, rows, delimiter);
    }

    throw new SkillError(`Unknown action: ${action}`);
  }

  private summarize(table: CsvTable): string {
    const lines = [
      `CSV parsed successfully.`,
      `Rows: ${table.rows.length}`,
      `Columns (${table.headers.length}): ${table.headers.join(", ")}`,
    ];

    if (table.rows.length > 0) {
      lines.push(`\nFirst row preview:`);
      for (const [k, v] of Object.entries(table.rows[0])) {
        lines.push(`  ${k}: ${v}`);
      }
    }

    return lines.join("\n");
  }

  private filterRows(rows: Record<string, string>[], col: string, filterValue: string): Record<string, string>[] {
    const gtMatch = filterValue.match(/^>(.+)$/);
    const ltMatch = filterValue.match(/^<(.+)$/);

    return rows.filter((row) => {
      const val = row[col] ?? "";
      if (gtMatch) return Number(val) > Number(gtMatch[1]);
      if (ltMatch) return Number(val) < Number(ltMatch[1]);
      return val === filterValue;
    });
  }

  private aggregate(rows: Record<string, string>[], col: string, fn: string): string {
    const values = rows.map((r) => r[col] ?? "");

    switch (fn) {
      case "count":
        return `count(${col}) = ${values.length}`;

      case "sum": {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        const sum = nums.reduce((a, b) => a + b, 0);
        return `sum(${col}) = ${sum}`;
      }

      case "average": {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        if (nums.length === 0) return `avg(${col}) = N/A (no numeric values)`;
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        return `avg(${col}) = ${avg.toFixed(4)}`;
      }

      case "min": {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        if (nums.length === 0) return `min(${col}) = N/A`;
        return `min(${col}) = ${Math.min(...nums)}`;
      }

      case "max": {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        if (nums.length === 0) return `max(${col}) = N/A`;
        return `max(${col}) = ${Math.max(...nums)}`;
      }

      default:
        throw new SkillError(`Unknown aggregate function: ${fn}`);
    }
  }
}
