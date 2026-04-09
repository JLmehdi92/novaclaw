// src/config/loader.ts
import fs from "fs";
import path from "path";
import os from "os";
import { NovaClawConfigSchema, CredentialsSchema, NovaClawConfig, Credentials } from "./schema.js";
import { SKILL_PRESETS } from "./defaults.js";
import { logger } from "../utils/logger.js";

const CONFIG_DIR = process.env.NOVACLAW_CONFIG_DIR || path.join(os.homedir(), ".novaclaw");
const CONFIG_FILE = path.join(CONFIG_DIR, "novaclaw.json");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

let cachedConfig: NovaClawConfig | null = null;
let cachedCredentials: Credentials | null = null;

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const subdirs = ["data", "workspaces", "logs", "skills"];
  for (const subdir of subdirs) {
    const fullPath = path.join(CONFIG_DIR, subdir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE) && fs.existsSync(CREDENTIALS_FILE);
}

export function loadConfig(): NovaClawConfig {
  if (cachedConfig) return cachedConfig;

  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Config file not found: ${CONFIG_FILE}. Run 'novaclaw setup' first.`);
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  cachedConfig = NovaClawConfigSchema.parse(raw);
  return cachedConfig;
}

export function loadCredentials(): Credentials {
  if (cachedCredentials) return cachedCredentials;

  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(`Credentials file not found: ${CREDENTIALS_FILE}. Run 'novaclaw setup' first.`);
  }

  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
  cachedCredentials = CredentialsSchema.parse(raw);
  return cachedCredentials;
}

export function saveConfig(config: NovaClawConfig): void {
  ensureConfigDir();
  const validated = NovaClawConfigSchema.parse(config);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(validated, null, 2));
  cachedConfig = validated;
  logger.info(`Config saved to ${CONFIG_FILE}`);
}

export function saveCredentials(credentials: Credentials): void {
  ensureConfigDir();
  const validated = CredentialsSchema.parse(credentials);
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(validated, null, 2), { mode: 0o600 });
  cachedCredentials = validated;
  logger.info(`Credentials saved to ${CREDENTIALS_FILE}`);
}

export function resetConfigCache(): void {
  cachedConfig = null;
  cachedCredentials = null;
}

export function getEnabledSkills(config: NovaClawConfig): string[] {
  const presetSkills = SKILL_PRESETS[config.skills.preset] || [];
  const enabled = new Set([...presetSkills, ...config.skills.enabled]);
  for (const disabled of config.skills.disabled) {
    enabled.delete(disabled);
  }
  return Array.from(enabled);
}

export function updateConfig(updates: Partial<NovaClawConfig>): NovaClawConfig {
  const current = loadConfig();
  const merged = { ...current, ...updates };
  saveConfig(merged as NovaClawConfig);
  return merged as NovaClawConfig;
}
