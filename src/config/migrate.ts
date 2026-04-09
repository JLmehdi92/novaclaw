// src/config/migrate.ts
import fs from "fs";
import path from "path";
import { NovaClawConfig, Credentials } from "./schema.js";
import { saveConfig, saveCredentials, getConfigDir } from "./loader.js";
import { logger } from "../utils/logger.js";

export function detectLegacyEnv(): string | null {
  const locations = [
    path.join(process.cwd(), ".env"),
    path.join(getConfigDir(), ".env"),
  ];
  for (const loc of locations) {
    if (fs.existsSync(loc)) return loc;
  }
  return null;
}

export function parseLegacyEnv(envPath: string): Record<string, string> {
  const content = fs.readFileSync(envPath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
}

export function migrateFromEnv(envPath: string): { config: NovaClawConfig; credentials: Credentials } {
  const env = parseLegacyEnv(envPath);

  const ownerId = Number(env.TELEGRAM_OWNER_ID) || 0;
  const allowedIds = (env.TELEGRAM_ALLOWED_IDS || "")
    .split(",")
    .filter(Boolean)
    .map(Number);

  const config: NovaClawConfig = {
    version: "2.0",
    agent: {
      name: "NovaClaw",
      language: (env.DEFAULT_LANGUAGE as "fr" | "en") || "fr",
      personality: "assistant",
      customSystemPrompt: null,
    },
    provider: {
      type: "anthropic",
      authMethod: env.ANTHROPIC_API_KEY ? "apikey" : "oauth",
      model: env.CLAUDE_MODEL || "claude-sonnet-4-6",
      fallbackModel: "claude-haiku-4-5",
    },
    channels: {
      telegram: {
        enabled: true,
        ownerId,
        allowedUsers: allowedIds.length > 0 ? allowedIds : [ownerId],
      },
    },
    skills: {
      preset: "standard",
      enabled: [],
      disabled: [],
      config: {},
    },
    security: {
      rateLimit: { messagesPerMinute: 30, cooldownSeconds: 60 },
      shell: { mode: "allowlist", allowedCommands: ["ls", "cat", "head", "tail", "grep", "find", "git", "npm", "node", "python"], blockedCommands: [] },
      http: { allowPrivateIPs: false, blockedDomains: [] },
      code: { allowedLanguages: ["javascript", "python"], maxExecutionTime: 30000 },
    },
    gateway: {
      autoStart: true,
      logLevel: (env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
    },
    service: {
      installed: false,
      name: "NovaClaw",
      autoStart: true,
    },
  };

  const credentials: Credentials = {
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN || "",
    },
    anthropic: {
      authMethod: env.ANTHROPIC_API_KEY ? "apikey" : "oauth",
      apiKey: env.ANTHROPIC_API_KEY || null,
      oauthToken: null,
      oauthEmail: null,
    },
  };

  return { config, credentials };
}

export function performMigration(envPath: string): void {
  const { config, credentials } = migrateFromEnv(envPath);
  saveConfig(config);
  saveCredentials(credentials);

  // Backup old .env
  const backupPath = envPath + ".backup";
  fs.renameSync(envPath, backupPath);
  logger.info(`Legacy .env migrated and backed up to ${backupPath}`);
}
