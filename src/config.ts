// src/config.ts
import { config as dotenvConfig } from "dotenv";
import { z } from "zod";
import path from "path";
import { ConfigError } from "./utils/errors.js";

dotenvConfig();

const configSchema = z.object({
  telegram: z.object({
    botToken: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    ownerId: z.number().positive(),
    allowedIds: z.array(z.number()).min(1),
  }),
  claude: z.object({
    apiKey: z.string().optional(),
    model: z.string().default("claude-sonnet-4-6"),
  }),
  database: z.object({
    path: z.string().default("./data/novaclaw.db"),
  }),
  language: z.enum(["fr", "en"]).default("fr"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
});

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const rawConfig = {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
      ownerId: Number(process.env.TELEGRAM_OWNER_ID) || 0,
      allowedIds: (process.env.TELEGRAM_ALLOWED_IDS || "")
        .split(",")
        .filter(Boolean)
        .map(Number),
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    },
    database: {
      path: process.env.DATABASE_PATH || "./data/novaclaw.db",
    },
    language: process.env.DEFAULT_LANGUAGE || "fr",
    logLevel: process.env.LOG_LEVEL || "info",
    nodeEnv: process.env.NODE_ENV || "development",
  };

  try {
    cachedConfig = configSchema.parse(rawConfig);
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new ConfigError(`Invalid configuration: ${issues}`);
    }
    throw error;
  }
}

export function resetConfig(): void {
  cachedConfig = null;
}
