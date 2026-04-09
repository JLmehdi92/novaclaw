// src/skills/data/calculator.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Safe math expression evaluator (no eval/Function)
// Supports: +, -, *, /, %, ** (power), unary minus, parentheses, and Math functions
// ---------------------------------------------------------------------------

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "fn"; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    const ch = s[i];

    // Numbers (including decimals)
    if (/[\d.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[\d.]/.test(s[i])) num += s[i++];
      if ((num.match(/\./g) || []).length > 1) throw new SkillError(`Invalid number: ${num}`);
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    // Math functions
    if (/[a-zA-Z]/.test(ch)) {
      let name = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) name += s[i++];
      const allowed = ["sqrt", "abs", "ceil", "floor", "round", "log", "log2", "log10", "sin", "cos", "tan", "pi", "e"];
      if (!allowed.includes(name)) throw new SkillError(`Unknown function/constant: ${name}`);
      if (name === "pi") { tokens.push({ type: "number", value: Math.PI }); continue; }
      if (name === "e") { tokens.push({ type: "number", value: Math.E }); continue; }
      tokens.push({ type: "fn", value: name });
      continue;
    }

    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }

    if ("+-*/%^".includes(ch)) {
      // Handle ** (power)
      if (ch === "*" && s[i + 1] === "*") {
        tokens.push({ type: "op", value: "**" });
        i += 2;
      } else if (ch === "^") {
        tokens.push({ type: "op", value: "**" });
        i++;
      } else {
        tokens.push({ type: "op", value: ch });
        i++;
      }
      continue;
    }

    throw new SkillError(`Unexpected character: ${ch}`);
  }

  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): number {
    const result = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new SkillError(`Unexpected token at position ${this.pos}`);
    }
    return result;
  }

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      this.consume();
      const right = this.parseMulDiv();
      left = t.value === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parsePower();
    while (true) {
      const t = this.peek();
      if (!t || t.type !== "op" || !["*", "/", "%"].includes(t.value)) break;
      this.consume();
      const right = this.parsePower();
      if (t.value === "*") left *= right;
      else if (t.value === "/") {
        if (right === 0) throw new SkillError("Division by zero");
        left /= right;
      } else left %= right;
    }
    return left;
  }

  private parsePower(): number {
    let base = this.parseUnary();
    const t = this.peek();
    if (t && t.type === "op" && t.value === "**") {
      this.consume();
      const exp = this.parseUnary(); // right-associative
      base = Math.pow(base, exp);
    }
    return base;
  }

  private parseUnary(): number {
    const t = this.peek();
    if (t && t.type === "op" && t.value === "-") {
      this.consume();
      return -this.parseAtom();
    }
    if (t && t.type === "op" && t.value === "+") {
      this.consume();
      return this.parseAtom();
    }
    return this.parseAtom();
  }

  private parseAtom(): number {
    const t = this.peek();
    if (!t) throw new SkillError("Unexpected end of expression");

    if (t.type === "number") { this.consume(); return t.value; }

    if (t.type === "fn") {
      this.consume();
      const argToken = this.peek();
      if (!argToken || argToken.type !== "lparen") throw new SkillError(`Expected '(' after ${t.value}`);
      this.consume(); // lparen
      const arg = this.parseAddSub();
      const close = this.peek();
      if (!close || close.type !== "rparen") throw new SkillError("Expected ')'");
      this.consume();
      const fns: Record<string, (x: number) => number> = {
        sqrt: Math.sqrt, abs: Math.abs, ceil: Math.ceil, floor: Math.floor,
        round: Math.round, log: Math.log, log2: Math.log2, log10: Math.log10,
        sin: Math.sin, cos: Math.cos, tan: Math.tan,
      };
      return fns[t.value](arg);
    }

    if (t.type === "lparen") {
      this.consume();
      const val = this.parseAddSub();
      const close = this.peek();
      if (!close || close.type !== "rparen") throw new SkillError("Missing closing parenthesis");
      this.consume();
      return val;
    }

    throw new SkillError(`Unexpected token: ${JSON.stringify(t)}`);
  }
}

function evaluate(expr: string): number {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens);
  return parser.parse();
}

// ---------------------------------------------------------------------------
// Unit conversion tables
// ---------------------------------------------------------------------------

type UnitCategory = {
  base: string;
  units: Record<string, number>; // factor to convert TO base unit
};

const UNIT_CATEGORIES: Record<string, UnitCategory> = {
  length: {
    base: "meter",
    units: {
      meter: 1, m: 1, km: 1000, kilometer: 1000, cm: 0.01, centimeter: 0.01,
      mm: 0.001, millimeter: 0.001,
      mile: 1609.344, miles: 1609.344, yard: 0.9144, yards: 0.9144,
      foot: 0.3048, feet: 0.3048, ft: 0.3048,
      inch: 0.0254, inches: 0.0254, in: 0.0254,
      nm: 1e-9, nanometer: 1e-9, um: 1e-6, micrometer: 1e-6,
    },
  },
  weight: {
    base: "kilogram",
    units: {
      kilogram: 1, kg: 1, gram: 0.001, g: 0.001, mg: 1e-6, milligram: 1e-6,
      tonne: 1000, ton: 907.185, pound: 0.453592, pounds: 0.453592, lb: 0.453592, lbs: 0.453592,
      ounce: 0.0283495, oz: 0.0283495, stone: 6.35029,
    },
  },
  data: {
    base: "byte",
    units: {
      byte: 1, b: 1, kb: 1024, kilobyte: 1024, mb: 1048576, megabyte: 1048576,
      gb: 1073741824, gigabyte: 1073741824, tb: 1099511627776, terabyte: 1099511627776,
      pb: 1125899906842624, petabyte: 1125899906842624,
      kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776,
    },
  },
  speed: {
    base: "mps",
    units: {
      mps: 1, "m/s": 1, kph: 1 / 3.6, "km/h": 1 / 3.6,
      mph: 0.44704, "mi/h": 0.44704, knot: 0.514444, fps: 0.3048,
    },
  },
  area: {
    base: "sqmeter",
    units: {
      sqmeter: 1, "m2": 1, "m²": 1, sqkm: 1e6, "km2": 1e6,
      sqcm: 1e-4, sqmm: 1e-6, sqmile: 2589988, sqyard: 0.836127,
      sqfoot: 0.092903, sqfeet: 0.092903, sqinch: 6.4516e-4,
      acre: 4046.86, hectare: 10000,
    },
  },
};

function convertUnit(value: number, from: string, to: string): string {
  const fromL = from.toLowerCase();
  const toL = to.toLowerCase();

  for (const [catName, cat] of Object.entries(UNIT_CATEGORIES)) {
    const fromFactor = cat.units[fromL];
    const toFactor = cat.units[toL];
    if (fromFactor !== undefined && toFactor !== undefined) {
      const inBase = value * fromFactor;
      const result = inBase / toFactor;
      return `${value} ${from} = ${formatNumber(result)} ${to} (${catName})`;
    }
  }

  // Temperature (special: not a simple factor)
  if ((fromL === "c" || fromL === "celsius" || fromL === "°c") &&
      (toL === "f" || toL === "fahrenheit" || toL === "°f")) {
    return `${value}°C = ${formatNumber(value * 9 / 5 + 32)}°F`;
  }
  if ((fromL === "f" || fromL === "fahrenheit" || toL === "°f") &&
      (toL === "c" || toL === "celsius" || toL === "°c")) {
    return `${value}°F = ${formatNumber((value - 32) * 5 / 9)}°C`;
  }
  if ((fromL === "c" || fromL === "celsius") && (toL === "k" || toL === "kelvin")) {
    return `${value}°C = ${formatNumber(value + 273.15)} K`;
  }
  if ((fromL === "k" || fromL === "kelvin") && (toL === "c" || toL === "celsius")) {
    return `${value} K = ${formatNumber(value - 273.15)}°C`;
  }
  if ((fromL === "f" || fromL === "fahrenheit") && (toL === "k" || toL === "kelvin")) {
    return `${value}°F = ${formatNumber((value - 32) * 5 / 9 + 273.15)} K`;
  }
  if ((fromL === "k" || fromL === "kelvin") && (toL === "f" || toL === "fahrenheit")) {
    return `${value} K = ${formatNumber((value - 273.15) * 9 / 5 + 32)}°F`;
  }

  throw new SkillError(
    `Unknown unit conversion from "${from}" to "${to}". Supported categories: ${Object.keys(UNIT_CATEGORIES).join(", ")}, temperature (C/F/K)`
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e10 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(6);
  const str = n.toPrecision(10).replace(/\.?0+$/, "");
  return str;
}

// ---------------------------------------------------------------------------
// Currency conversion (illustrative fixed rates)
// ---------------------------------------------------------------------------

const CURRENCY_RATES_VS_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36, AUD: 1.53,
  CHF: 0.90, CNY: 7.24, INR: 83.1, MXN: 17.2, BRL: 4.97, KRW: 1325,
  SGD: 1.34, HKD: 7.82, NOK: 10.6, SEK: 10.4, DKK: 6.88, NZD: 1.63,
  ZAR: 18.6, TRY: 32.0, RUB: 90.0, PLN: 4.02, THB: 35.1, IDR: 15600,
  MAD: 10.1, DZD: 134.5, TND: 3.09, EGP: 30.9, AED: 3.67, SAR: 3.75,
  QAR: 3.64, KWD: 0.308, BHD: 0.376, OMR: 0.385,
};

function convertCurrency(amount: number, from: string, to: string): string {
  const fromU = from.toUpperCase();
  const toU = to.toUpperCase();
  const fromRate = CURRENCY_RATES_VS_USD[fromU];
  const toRate = CURRENCY_RATES_VS_USD[toU];

  if (fromRate === undefined) throw new SkillError(`Unknown currency: ${from}. Supported: ${Object.keys(CURRENCY_RATES_VS_USD).join(", ")}`);
  if (toRate === undefined) throw new SkillError(`Unknown currency: ${to}. Supported: ${Object.keys(CURRENCY_RATES_VS_USD).join(", ")}`);

  const inUsd = amount / fromRate;
  const result = inUsd * toRate;
  return [
    `${formatNumber(amount)} ${fromU} = ${formatNumber(result)} ${toU}`,
    `(Rate: 1 ${fromU} = ${formatNumber(toRate / fromRate)} ${toU})`,
    `Note: These are illustrative fixed rates, not live market rates.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export class CalculatorSkill extends BaseSkill {
  name = "calculator";
  description =
    "Evaluate math expressions, convert units (length/weight/data/speed/area/temperature), calculate percentages, and convert currencies with illustrative rates.";
  category = "data";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["calculate", "convert_unit", "percentage", "convert_currency"],
        description:
          "Action: calculate (evaluate math expression), convert_unit (unit conversion), percentage (% calculations), convert_currency (currency conversion with fixed rates)",
      },
      expression: {
        type: "string",
        description:
          "Math expression to evaluate, e.g. '2 + 3 * sqrt(16)'. Supports: +, -, *, /, %, **, sqrt, abs, ceil, floor, round, log, sin, cos, tan, pi, e",
      },
      value: {
        type: "number",
        description: "Numeric value for convert_unit, percentage, or convert_currency",
      },
      from_unit: {
        type: "string",
        description: "Source unit (e.g. 'km', 'kg', 'GB', 'C', 'USD')",
      },
      to_unit: {
        type: "string",
        description: "Target unit (e.g. 'miles', 'lbs', 'MB', 'F', 'EUR')",
      },
      percentage_of: {
        type: "number",
        description: "The total/base value for percentage calculations",
      },
      percentage_type: {
        type: "string",
        enum: ["of", "change", "is_what"],
        description:
          "Type: 'of' (X% of Y), 'change' (% change from value to percentage_of), 'is_what' (value is what % of percentage_of)",
      },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, _context: SkillContext): Promise<string> {
    const action = args.action as string;

    logger.info(`[Calculator] action=${action}`);

    switch (action) {
      case "calculate": {
        const expr = args.expression as string;
        if (!expr) throw new SkillError("expression is required for action=calculate");
        const result = evaluate(expr);
        if (!isFinite(result)) throw new SkillError(`Result is not finite: ${result}`);
        return `${expr} = ${formatNumber(result)}`;
      }

      case "convert_unit": {
        const value = args.value as number;
        const from = args.from_unit as string;
        const to = args.to_unit as string;
        if (value === undefined || value === null) throw new SkillError("value is required");
        if (!from) throw new SkillError("from_unit is required");
        if (!to) throw new SkillError("to_unit is required");
        return convertUnit(value, from, to);
      }

      case "percentage": {
        const value = args.value as number;
        const of = args.percentage_of as number;
        const ptype = (args.percentage_type as string) || "of";
        if (value === undefined || value === null) throw new SkillError("value is required");

        switch (ptype) {
          case "of":
            if (of === undefined) throw new SkillError("percentage_of is required for type=of");
            return `${value}% of ${of} = ${formatNumber((value / 100) * of)}`;

          case "change":
            if (of === undefined) throw new SkillError("percentage_of is required for type=change");
            if (value === 0) throw new SkillError("value (original) cannot be 0 for percentage change");
            return `Percentage change from ${value} to ${of} = ${formatNumber(((of - value) / Math.abs(value)) * 100)}%`;

          case "is_what":
            if (of === undefined) throw new SkillError("percentage_of is required for type=is_what");
            if (of === 0) throw new SkillError("percentage_of (total) cannot be 0");
            return `${value} is ${formatNumber((value / of) * 100)}% of ${of}`;

          default:
            throw new SkillError(`Unknown percentage_type: ${ptype}`);
        }
      }

      case "convert_currency": {
        const amount = args.value as number;
        const from = args.from_unit as string;
        const to = args.to_unit as string;
        if (amount === undefined || amount === null) throw new SkillError("value is required");
        if (!from) throw new SkillError("from_unit (currency code) is required");
        if (!to) throw new SkillError("to_unit (currency code) is required");
        return convertCurrency(amount, from, to);
      }

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }
}
