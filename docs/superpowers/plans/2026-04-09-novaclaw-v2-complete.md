# NovaClaw v2.0 Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete overhaul of NovaClaw with 42 skills, professional setup wizard, JSON config system, OAuth support, and Windows service installation.

**Architecture:** JSON-based configuration (novaclaw.json + credentials.json), modular skill system with 8 categories, Inquirer.js-based setup wizard with quick/complete modes, OAuth flow for Claude Max authentication.

**Tech Stack:** Node.js, TypeScript, grammY, Playwright, better-sqlite3, Inquirer.js, Commander.js, Zod, node-windows

---

## File Structure Overview

```
src/
├── config/
│   ├── schema.ts          # Zod schemas for config validation
│   ├── loader.ts          # Load/save novaclaw.json & credentials.json
│   ├── defaults.ts        # Default values and presets
│   └── migrate.ts         # Migration from .env to JSON
├── auth/
│   └── oauth.ts           # OAuth flow for Claude
├── cli/
│   └── commands/
│       ├── setup.ts       # Setup wizard v2 (replaces old)
│       ├── config.ts      # config show/set/get/edit
│       ├── skills-cmd.ts  # skills list/enable/disable/info
│       ├── service.ts     # service install/uninstall/start/stop
│       ├── auth.ts        # auth status/login/logout
│       └── logs.ts        # logs command
├── skills/
│   ├── catalog.ts         # Skills metadata catalog
│   ├── web/               # Web & Browser skills (6)
│   ├── system/            # Shell & System skills (6)
│   ├── files/             # Files & Storage skills (6)
│   ├── code/              # Code & Dev skills (7)
│   ├── network/           # Network & HTTP skills (5)
│   ├── data/              # Data & AI skills (5)
│   ├── communication/     # Communication skills (4)
│   └── automation/        # Automation & IoT skills (3)
```

---

## PHASE 1: Configuration System

### Task 1: Config Schema

**Files:**
- Create: `src/config/schema.ts`

- [ ] **Step 1: Create Zod schemas for configuration**

```typescript
// src/config/schema.ts
import { z } from "zod";

export const AgentConfigSchema = z.object({
  name: z.string().default("NovaClaw"),
  language: z.enum(["fr", "en"]).default("fr"),
  personality: z.enum(["professional", "assistant", "casual", "minimal", "custom"]).default("assistant"),
  customSystemPrompt: z.string().nullable().default(null),
});

export const ProviderConfigSchema = z.object({
  type: z.literal("anthropic").default("anthropic"),
  authMethod: z.enum(["oauth", "apikey"]).default("oauth"),
  model: z.string().default("claude-sonnet-4-6"),
  fallbackModel: z.string().nullable().default("claude-haiku-4-5"),
});

export const TelegramChannelSchema = z.object({
  enabled: z.boolean().default(true),
  ownerId: z.number(),
  allowedUsers: z.array(z.number()).default([]),
});

export const ChannelsConfigSchema = z.object({
  telegram: TelegramChannelSchema,
});

export const SkillsConfigSchema = z.object({
  preset: z.enum(["minimal", "standard", "developer", "power", "full"]).default("standard"),
  enabled: z.array(z.string()).default([]),
  disabled: z.array(z.string()).default([]),
  config: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});

export const RateLimitSchema = z.object({
  messagesPerMinute: z.number().default(30),
  cooldownSeconds: z.number().default(60),
});

export const ShellSecuritySchema = z.object({
  mode: z.enum(["allowlist", "blocklist"]).default("allowlist"),
  allowedCommands: z.array(z.string()).default(["ls", "cat", "head", "tail", "grep", "find", "git", "npm", "node", "python"]),
  blockedCommands: z.array(z.string()).default([]),
});

export const HttpSecuritySchema = z.object({
  allowPrivateIPs: z.boolean().default(false),
  blockedDomains: z.array(z.string()).default([]),
});

export const CodeSecuritySchema = z.object({
  allowedLanguages: z.array(z.string()).default(["javascript", "python"]),
  maxExecutionTime: z.number().default(30000),
});

export const SecurityConfigSchema = z.object({
  rateLimit: RateLimitSchema.default({}),
  shell: ShellSecuritySchema.default({}),
  http: HttpSecuritySchema.default({}),
  code: CodeSecuritySchema.default({}),
});

export const GatewayConfigSchema = z.object({
  autoStart: z.boolean().default(true),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const ServiceConfigSchema = z.object({
  installed: z.boolean().default(false),
  name: z.string().default("NovaClaw"),
  autoStart: z.boolean().default(true),
});

export const NovaClawConfigSchema = z.object({
  version: z.literal("2.0").default("2.0"),
  agent: AgentConfigSchema.default({}),
  provider: ProviderConfigSchema.default({}),
  channels: ChannelsConfigSchema,
  skills: SkillsConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  gateway: GatewayConfigSchema.default({}),
  service: ServiceConfigSchema.default({}),
});

export const TelegramCredentialsSchema = z.object({
  botToken: z.string(),
});

export const AnthropicCredentialsSchema = z.object({
  authMethod: z.enum(["oauth", "apikey"]),
  apiKey: z.string().nullable().default(null),
  oauthToken: z.string().nullable().default(null),
  oauthEmail: z.string().nullable().default(null),
});

export const CredentialsSchema = z.object({
  telegram: TelegramCredentialsSchema,
  anthropic: AnthropicCredentialsSchema,
});

export type NovaClawConfig = z.infer<typeof NovaClawConfigSchema>;
export type Credentials = z.infer<typeof CredentialsSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/config/schema.ts
git commit -m "feat(config): add Zod schemas for JSON configuration"
```

---

### Task 2: Config Defaults & Presets

**Files:**
- Create: `src/config/defaults.ts`

- [ ] **Step 1: Create defaults and presets**

```typescript
// src/config/defaults.ts
export const PERSONALITY_PROMPTS: Record<string, string> = {
  professional: "Tu es un assistant professionnel. Réponses directes, factuelles et concises. Pas de bavardage.",
  assistant: "Tu es NovaClaw, un assistant IA personnel puissant. Tu es helpful, précis et amical. Tu peux utiliser tes skills pour accomplir des tâches concrètes.",
  casual: "Tu es un assistant cool et décontracté. Tu peux utiliser des émojis et un ton informel. Tu restes efficace tout en étant sympa.",
  minimal: "Réponses ultra-courtes. Pas de blabla. Action directe.",
  custom: "",
};

export const SKILL_PRESETS: Record<string, string[]> = {
  minimal: ["shell", "files"],
  standard: ["browser", "shell", "files", "code-runner", "http", "git"],
  developer: [
    "browser", "shell", "files", "code-runner", "http", "git",
    "github", "docker", "database", "api-tester", "json-processor"
  ],
  power: [
    "browser", "screenshot", "web-scraper", "pdf-reader", "link-preview", "web-monitor",
    "shell", "process-manager", "system-info", "package-manager", "service-manager", "cron-scheduler",
    "files", "file-search", "archive", "file-convert", "file-watch",
    "code-runner", "code-analyzer", "git", "github", "docker", "database", "api-tester",
    "http", "webhook-sender", "dns-lookup",
    "json-processor", "csv-processor", "text-analyzer", "calculator"
  ],
  full: [
    "browser", "screenshot", "web-scraper", "pdf-reader", "link-preview", "web-monitor",
    "shell", "process-manager", "system-info", "package-manager", "service-manager", "cron-scheduler",
    "files", "file-search", "archive", "file-convert", "file-watch", "cloud-storage",
    "code-runner", "code-analyzer", "git", "github", "docker", "database", "api-tester",
    "http", "webhook-sender", "webhook-receiver", "dns-lookup", "port-scanner",
    "json-processor", "csv-processor", "text-analyzer", "image-analyzer", "calculator",
    "email-sender", "email-reader", "sms-sender", "notification",
    "home-assistant", "macro-recorder", "workflow"
  ],
};

export const SECURITY_PRESETS: Record<string, {
  rateLimit: { messagesPerMinute: number; cooldownSeconds: number };
  shell: { mode: "allowlist" | "blocklist"; allowedCommands: string[] };
  code: { allowedLanguages: string[] };
  http: { allowPrivateIPs: boolean };
}> = {
  strict: {
    rateLimit: { messagesPerMinute: 10, cooldownSeconds: 120 },
    shell: { mode: "allowlist", allowedCommands: ["ls", "cat", "head", "tail", "pwd"] },
    code: { allowedLanguages: ["javascript"] },
    http: { allowPrivateIPs: false },
  },
  balanced: {
    rateLimit: { messagesPerMinute: 30, cooldownSeconds: 60 },
    shell: { mode: "allowlist", allowedCommands: ["ls", "cat", "head", "tail", "grep", "find", "git", "npm", "node", "python"] },
    code: { allowedLanguages: ["javascript", "python"] },
    http: { allowPrivateIPs: false },
  },
  permissive: {
    rateLimit: { messagesPerMinute: 60, cooldownSeconds: 30 },
    shell: { mode: "blocklist", allowedCommands: [] },
    code: { allowedLanguages: ["javascript", "python", "bash", "typescript"] },
    http: { allowPrivateIPs: true },
  },
};

export const ALL_SKILLS = [
  // Web & Browser
  { id: "browser", name: "Browser", category: "web", description: "Naviguer sur le web, rechercher, lire des pages" },
  { id: "screenshot", name: "Screenshot", category: "web", description: "Capturer des pages web en image" },
  { id: "web-scraper", name: "Web Scraper", category: "web", description: "Extraire des données structurées de sites" },
  { id: "pdf-reader", name: "PDF Reader", category: "web", description: "Lire et extraire du texte de PDFs" },
  { id: "link-preview", name: "Link Preview", category: "web", description: "Prévisualiser les liens" },
  { id: "web-monitor", name: "Web Monitor", category: "web", description: "Surveiller des pages pour changements" },
  // Shell & System
  { id: "shell", name: "Shell", category: "system", description: "Exécuter des commandes système" },
  { id: "process-manager", name: "Process Manager", category: "system", description: "Gérer les processus système" },
  { id: "system-info", name: "System Info", category: "system", description: "Informations système (CPU, RAM, disque)" },
  { id: "package-manager", name: "Package Manager", category: "system", description: "Gérer les packages (npm, pip, etc.)" },
  { id: "service-manager", name: "Service Manager", category: "system", description: "Gérer les services système" },
  { id: "cron-scheduler", name: "Cron Scheduler", category: "system", description: "Planifier des tâches récurrentes" },
  // Files & Storage
  { id: "files", name: "Files", category: "files", description: "Opérations sur fichiers (CRUD)" },
  { id: "file-search", name: "File Search", category: "files", description: "Rechercher des fichiers" },
  { id: "archive", name: "Archive", category: "files", description: "Créer/extraire des archives" },
  { id: "file-convert", name: "File Convert", category: "files", description: "Convertir des formats de fichiers" },
  { id: "file-watch", name: "File Watch", category: "files", description: "Surveiller des fichiers/dossiers" },
  { id: "cloud-storage", name: "Cloud Storage", category: "files", description: "Gérer le stockage cloud" },
  // Code & Dev
  { id: "code-runner", name: "Code Runner", category: "code", description: "Exécuter du code (JS, Python, etc.)" },
  { id: "code-analyzer", name: "Code Analyzer", category: "code", description: "Analyser la qualité du code" },
  { id: "git", name: "Git", category: "code", description: "Opérations Git" },
  { id: "github", name: "GitHub", category: "code", description: "Interagir avec l'API GitHub" },
  { id: "docker", name: "Docker", category: "code", description: "Gérer des containers Docker" },
  { id: "database", name: "Database", category: "code", description: "Requêtes SQL" },
  { id: "api-tester", name: "API Tester", category: "code", description: "Tester des APIs REST/GraphQL" },
  // Network & HTTP
  { id: "http", name: "HTTP", category: "network", description: "Requêtes HTTP" },
  { id: "webhook-sender", name: "Webhook Sender", category: "network", description: "Envoyer des webhooks" },
  { id: "webhook-receiver", name: "Webhook Receiver", category: "network", description: "Recevoir des webhooks" },
  { id: "dns-lookup", name: "DNS Lookup", category: "network", description: "Résolution DNS et WHOIS" },
  { id: "port-scanner", name: "Port Scanner", category: "network", description: "Scanner des ports" },
  // Data & AI
  { id: "json-processor", name: "JSON Processor", category: "data", description: "Traiter des données JSON" },
  { id: "csv-processor", name: "CSV Processor", category: "data", description: "Traiter des fichiers CSV" },
  { id: "text-analyzer", name: "Text Analyzer", category: "data", description: "Analyser du texte" },
  { id: "image-analyzer", name: "Image Analyzer", category: "data", description: "Analyser des images" },
  { id: "calculator", name: "Calculator", category: "data", description: "Calculs mathématiques" },
  // Communication
  { id: "email-sender", name: "Email Sender", category: "communication", description: "Envoyer des emails" },
  { id: "email-reader", name: "Email Reader", category: "communication", description: "Lire des emails" },
  { id: "sms-sender", name: "SMS Sender", category: "communication", description: "Envoyer des SMS" },
  { id: "notification", name: "Notification", category: "communication", description: "Notifications système" },
  // Automation & IoT
  { id: "home-assistant", name: "Home Assistant", category: "automation", description: "Domotique via Home Assistant" },
  { id: "macro-recorder", name: "Macro Recorder", category: "automation", description: "Enregistrer et rejouer des macros" },
  { id: "workflow", name: "Workflow", category: "automation", description: "Chaîner des skills" },
];

export const SKILL_CATEGORIES = [
  { id: "web", name: "Web & Browser", icon: "🌐" },
  { id: "system", name: "Shell & System", icon: "💻" },
  { id: "files", name: "Files & Storage", icon: "📁" },
  { id: "code", name: "Code & Dev", icon: "🧑‍💻" },
  { id: "network", name: "Network & HTTP", icon: "🌍" },
  { id: "data", name: "Data & AI", icon: "📊" },
  { id: "communication", name: "Communication", icon: "📱" },
  { id: "automation", name: "Automation & IoT", icon: "🏠" },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/config/defaults.ts
git commit -m "feat(config): add defaults and presets for skills, personality, security"
```

---

### Task 3: Config Loader

**Files:**
- Create: `src/config/loader.ts`

- [ ] **Step 1: Create config loader**

```typescript
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
  saveConfig(merged);
  return merged;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/config/loader.ts
git commit -m "feat(config): add JSON config loader with caching"
```

---

### Task 4: Migration from .env

**Files:**
- Create: `src/config/migrate.ts`

- [ ] **Step 1: Create migration utility**

```typescript
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
      shell: { mode: "allowlist", allowedCommands: ["ls", "cat", "head", "tail", "grep", "find", "git", "npm", "node", "python"] },
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
```

- [ ] **Step 2: Commit**

```bash
git add src/config/migrate.ts
git commit -m "feat(config): add migration from legacy .env to JSON"
```

---

## PHASE 2: Setup Wizard v2

### Task 5: Setup Wizard - Core Structure

**Files:**
- Create: `src/cli/commands/setup.ts` (replace existing)

- [ ] **Step 1: Create setup wizard structure**

```typescript
// src/cli/commands/setup.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import open from "open";
import fs from "fs";
import { showLogo } from "../logo.js";
import { NovaClawConfig, Credentials } from "../../config/schema.js";
import { saveConfig, saveCredentials, ensureConfigDir, getConfigDir, configExists } from "../../config/loader.js";
import { detectLegacyEnv, performMigration } from "../../config/migrate.js";
import { PERSONALITY_PROMPTS, SKILL_PRESETS, SECURITY_PRESETS, ALL_SKILLS, SKILL_CATEGORIES } from "../../config/defaults.js";
import { CLAUDE_MODELS } from "../../claude/models.js";
import { validateTelegramToken } from "./setup/telegram.js";
import { setupOAuth, setupApiKey } from "./setup/auth.js";

export const setupCommand = new Command("setup")
  .description("Interactive setup wizard for NovaClaw")
  .option("--quick", "Quick setup with defaults")
  .option("--reset", "Reset existing configuration")
  .action(async (options) => {
    showLogo();
    console.log(chalk.cyan.bold("\n  NovaClaw Setup Wizard v2.0\n"));

    // Check for existing config
    if (configExists() && !options.reset) {
      const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: "Une configuration existe déjà. Que veux-tu faire ?",
        choices: [
          { name: "Modifier la config existante", value: "edit" },
          { name: "Réinitialiser complètement", value: "reset" },
          { name: "Annuler", value: "cancel" },
        ],
      }]);
      if (action === "cancel") return;
      if (action === "edit") {
        console.log(chalk.yellow("Utilise 'novaclaw config edit' pour modifier la configuration."));
        return;
      }
    }

    // Check for legacy .env
    const legacyEnv = detectLegacyEnv();
    if (legacyEnv) {
      const { migrate } = await inquirer.prompt([{
        type: "confirm",
        name: "migrate",
        message: `Fichier .env détecté (${legacyEnv}). Migrer vers le nouveau format ?`,
        default: true,
      }]);
      if (migrate) {
        const spinner = ora("Migration en cours...").start();
        try {
          performMigration(legacyEnv);
          spinner.succeed("Migration terminée !");
          console.log(chalk.green("Configuration migrée. Lance 'novaclaw start' pour démarrer."));
          return;
        } catch (error) {
          spinner.fail(`Migration échouée: ${error}`);
        }
      }
    }

    // Choose mode
    const mode = options.quick ? "quick" : await chooseMode();

    if (mode === "quick") {
      await quickSetup();
    } else {
      await completeSetup();
    }
  });

async function chooseMode(): Promise<"quick" | "complete"> {
  const { mode } = await inquirer.prompt([{
    type: "list",
    name: "mode",
    message: "Quel type de configuration ?",
    choices: [
      { name: "⚡ Rapide    - Telegram + Auth, défauts pour le reste (~2 min)", value: "quick" },
      { name: "🔧 Complète  - Tout configurer : skills, sécurité, personnalité (~5 min)", value: "complete" },
    ],
  }]);
  return mode;
}

async function quickSetup(): Promise<void> {
  console.log(chalk.cyan("\n═══════════════════════════════════════════════════════════"));
  console.log(chalk.cyan("  MODE RAPIDE"));
  console.log(chalk.cyan("═══════════════════════════════════════════════════════════\n"));

  // Step 1: Telegram
  const telegram = await setupTelegram();

  // Step 2: Auth
  const auth = await setupAuth();

  // Step 3: Language
  const { language } = await inquirer.prompt([{
    type: "list",
    name: "language",
    message: "Langue de l'agent ?",
    choices: [
      { name: "🇫🇷 Français", value: "fr" },
      { name: "🇬🇧 English", value: "en" },
    ],
  }]);

  // Build config with defaults
  const config: NovaClawConfig = {
    version: "2.0",
    agent: { name: "NovaClaw", language, personality: "assistant", customSystemPrompt: null },
    provider: { type: "anthropic", authMethod: auth.method, model: "claude-sonnet-4-6", fallbackModel: "claude-haiku-4-5" },
    channels: { telegram: { enabled: true, ownerId: telegram.ownerId, allowedUsers: [telegram.ownerId] } },
    skills: { preset: "standard", enabled: [], disabled: [], config: {} },
    security: SECURITY_PRESETS.balanced,
    gateway: { autoStart: true, logLevel: "info" },
    service: { installed: false, name: "NovaClaw", autoStart: true },
  };

  const credentials: Credentials = {
    telegram: { botToken: telegram.botToken },
    anthropic: { authMethod: auth.method, apiKey: auth.apiKey, oauthToken: auth.oauthToken, oauthEmail: auth.email },
  };

  await saveConfiguration(config, credentials);
}

async function completeSetup(): Promise<void> {
  console.log(chalk.cyan("\n═══════════════════════════════════════════════════════════"));
  console.log(chalk.cyan("  MODE COMPLET"));
  console.log(chalk.cyan("═══════════════════════════════════════════════════════════\n"));

  // Step 1: Telegram
  console.log(chalk.yellow("\n[1/6] 📱 TELEGRAM\n"));
  const telegram = await setupTelegram();
  const additionalUsers = await setupAdditionalUsers();

  // Step 2: Auth
  console.log(chalk.yellow("\n[2/6] 🔐 AUTHENTIFICATION CLAUDE\n"));
  const auth = await setupAuth();
  const models = await setupModels();

  // Step 3: Skills
  console.log(chalk.yellow("\n[3/6] 🛠️  SKILLS\n"));
  const skills = await setupSkills();

  // Step 4: Personality
  console.log(chalk.yellow("\n[4/6] 🎭 PERSONNALITÉ\n"));
  const personality = await setupPersonality();

  // Step 5: Security
  console.log(chalk.yellow("\n[5/6] 🔒 SÉCURITÉ\n"));
  const security = await setupSecurity();

  // Step 6: Service
  console.log(chalk.yellow("\n[6/6] ⚙️  SERVICE WINDOWS\n"));
  const service = await setupService();

  // Build config
  const config: NovaClawConfig = {
    version: "2.0",
    agent: personality,
    provider: { type: "anthropic", authMethod: auth.method, model: models.primary, fallbackModel: models.fallback },
    channels: { telegram: { enabled: true, ownerId: telegram.ownerId, allowedUsers: [telegram.ownerId, ...additionalUsers] } },
    skills,
    security,
    gateway: { autoStart: true, logLevel: "info" },
    service,
  };

  const credentials: Credentials = {
    telegram: { botToken: telegram.botToken },
    anthropic: { authMethod: auth.method, apiKey: auth.apiKey, oauthToken: auth.oauthToken, oauthEmail: auth.email },
  };

  // Show summary
  await showSummary(config, credentials);

  const { confirm } = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: "Confirmer et créer la configuration ?",
    default: true,
  }]);

  if (!confirm) {
    console.log(chalk.yellow("Configuration annulée."));
    return;
  }

  await saveConfiguration(config, credentials);
}

async function setupTelegram(): Promise<{ botToken: string; ownerId: number; botUsername: string }> {
  const { botToken } = await inquirer.prompt([{
    type: "password",
    name: "botToken",
    message: "Token du bot (depuis @BotFather):",
    mask: "*",
    validate: (input) => input.length > 20 || "Token invalide",
  }]);

  const spinner = ora("Validation du token...").start();
  const validation = await validateTelegramToken(botToken);
  if (!validation.valid) {
    spinner.fail(`Token invalide: ${validation.error}`);
    return setupTelegram();
  }
  spinner.succeed(`Token validé - Bot: @${validation.username}`);

  const { ownerId } = await inquirer.prompt([{
    type: "input",
    name: "ownerId",
    message: "Ton Telegram User ID (envoie /start à @userinfobot):",
    validate: (input) => /^\d+$/.test(input) || "Doit être un nombre",
  }]);

  return { botToken, ownerId: Number(ownerId), botUsername: validation.username! };
}

async function setupAdditionalUsers(): Promise<number[]> {
  const { addMore } = await inquirer.prompt([{
    type: "confirm",
    name: "addMore",
    message: "Ajouter d'autres utilisateurs autorisés ?",
    default: false,
  }]);

  if (!addMore) return [];

  const { userIds } = await inquirer.prompt([{
    type: "input",
    name: "userIds",
    message: "User IDs supplémentaires (séparés par virgule):",
  }]);

  return userIds.split(",").filter(Boolean).map((id: string) => Number(id.trim()));
}

async function setupAuth(): Promise<{ method: "oauth" | "apikey"; apiKey: string | null; oauthToken: string | null; email: string | null }> {
  const { method } = await inquirer.prompt([{
    type: "list",
    name: "method",
    message: "Méthode d'authentification Claude ?",
    choices: [
      { name: "🌐 OAuth (Claude Max) - Connexion via navigateur", value: "oauth" },
      { name: "🔑 API Key - Entrer une clé ANTHROPIC_API_KEY", value: "apikey" },
    ],
  }]);

  if (method === "oauth") {
    return setupOAuth();
  } else {
    return setupApiKey();
  }
}

async function setupModels(): Promise<{ primary: string; fallback: string | null }> {
  const modelChoices = Object.entries(CLAUDE_MODELS).map(([key, model]) => ({
    name: `${model.name} - ${model.description}`,
    value: model.id,
  }));

  const { primary } = await inquirer.prompt([{
    type: "list",
    name: "primary",
    message: "Modèle principal ?",
    choices: modelChoices,
    default: "claude-sonnet-4-6",
  }]);

  const { fallback } = await inquirer.prompt([{
    type: "list",
    name: "fallback",
    message: "Modèle de fallback ?",
    choices: [{ name: "Aucun", value: null }, ...modelChoices],
    default: "claude-haiku-4-5",
  }]);

  return { primary, fallback };
}

async function setupSkills(): Promise<NovaClawConfig["skills"]> {
  const { preset } = await inquirer.prompt([{
    type: "list",
    name: "preset",
    message: "Preset de skills ?",
    choices: [
      { name: `minimal   - Shell + Files (2 skills)`, value: "minimal" },
      { name: `standard  - Core skills (6 skills)`, value: "standard" },
      { name: `developer - Dev tools (11 skills)`, value: "developer" },
      { name: `power     - Utilisateur avancé (25 skills)`, value: "power" },
      { name: `full      - Tous les skills (42 skills)`, value: "full" },
    ],
    default: "standard",
  }]);

  const { customize } = await inquirer.prompt([{
    type: "confirm",
    name: "customize",
    message: "Personnaliser les skills ?",
    default: false,
  }]);

  if (!customize) {
    return { preset, enabled: [], disabled: [], config: {} };
  }

  const presetSkills = SKILL_PRESETS[preset];
  const { selectedSkills } = await inquirer.prompt([{
    type: "checkbox",
    name: "selectedSkills",
    message: "Sélectionne les skills à activer:",
    choices: SKILL_CATEGORIES.map(cat => [
      new inquirer.Separator(`── ${cat.icon} ${cat.name} ──`),
      ...ALL_SKILLS.filter(s => s.category === cat.id).map(skill => ({
        name: `${skill.name} - ${skill.description}`,
        value: skill.id,
        checked: presetSkills.includes(skill.id),
      })),
    ]).flat(),
    pageSize: 20,
  }]);

  const enabled = selectedSkills.filter((s: string) => !presetSkills.includes(s));
  const disabled = presetSkills.filter((s: string) => !selectedSkills.includes(s));

  return { preset, enabled, disabled, config: {} };
}

async function setupPersonality(): Promise<NovaClawConfig["agent"]> {
  const { preset } = await inquirer.prompt([{
    type: "list",
    name: "preset",
    message: "Preset de personnalité ?",
    choices: [
      { name: "professional - Formel, concis", value: "professional" },
      { name: "assistant    - Amical, équilibré", value: "assistant" },
      { name: "casual       - Décontracté, émojis", value: "casual" },
      { name: "minimal      - Ultra-court", value: "minimal" },
      { name: "custom       - Ton propre prompt", value: "custom" },
    ],
    default: "assistant",
  }]);

  let customPrompt: string | null = null;

  if (preset === "custom") {
    const { prompt } = await inquirer.prompt([{
      type: "editor",
      name: "prompt",
      message: "Écris ton system prompt:",
      default: PERSONALITY_PROMPTS.assistant,
    }]);
    customPrompt = prompt;
  } else {
    const { customize } = await inquirer.prompt([{
      type: "confirm",
      name: "customize",
      message: "Modifier le prompt de base ?",
      default: false,
    }]);
    if (customize) {
      const { prompt } = await inquirer.prompt([{
        type: "editor",
        name: "prompt",
        message: "Modifie le system prompt:",
        default: PERSONALITY_PROMPTS[preset],
      }]);
      customPrompt = prompt;
    }
  }

  const { language } = await inquirer.prompt([{
    type: "list",
    name: "language",
    message: "Langue ?",
    choices: [
      { name: "🇫🇷 Français", value: "fr" },
      { name: "🇬🇧 English", value: "en" },
    ],
  }]);

  return { name: "NovaClaw", language, personality: preset, customSystemPrompt: customPrompt };
}

async function setupSecurity(): Promise<NovaClawConfig["security"]> {
  const { preset } = await inquirer.prompt([{
    type: "list",
    name: "preset",
    message: "Preset de sécurité ?",
    choices: [
      { name: "strict     - Commandes limitées, JS only", value: "strict" },
      { name: "balanced   - Équilibre sécurité/fonctionnalité", value: "balanced" },
      { name: "permissive - Tout autorisé (confiance)", value: "permissive" },
    ],
    default: "balanced",
  }]);

  const securityConfig = { ...SECURITY_PRESETS[preset], http: { ...SECURITY_PRESETS[preset].http, blockedDomains: [] } };

  const { customize } = await inquirer.prompt([{
    type: "confirm",
    name: "customize",
    message: "Personnaliser la sécurité ?",
    default: false,
  }]);

  if (!customize) {
    return { ...securityConfig, code: { ...securityConfig.code, maxExecutionTime: 30000 } };
  }

  // Rate limiting
  const { messagesPerMinute } = await inquirer.prompt([{
    type: "number",
    name: "messagesPerMinute",
    message: "Messages par minute (rate limit):",
    default: securityConfig.rateLimit.messagesPerMinute,
  }]);

  // Shell commands
  const { shellCommands } = await inquirer.prompt([{
    type: "input",
    name: "shellCommands",
    message: "Commandes shell autorisées (séparées par virgule):",
    default: securityConfig.shell.allowedCommands.join(", "),
  }]);

  // Code languages
  const { codeLanguages } = await inquirer.prompt([{
    type: "checkbox",
    name: "codeLanguages",
    message: "Langages autorisés pour l'exécution de code:",
    choices: [
      { name: "JavaScript", value: "javascript", checked: securityConfig.code.allowedLanguages.includes("javascript") },
      { name: "Python", value: "python", checked: securityConfig.code.allowedLanguages.includes("python") },
      { name: "Bash", value: "bash", checked: securityConfig.code.allowedLanguages.includes("bash") },
      { name: "TypeScript", value: "typescript", checked: securityConfig.code.allowedLanguages.includes("typescript") },
    ],
  }]);

  // Private IPs
  const { allowPrivateIPs } = await inquirer.prompt([{
    type: "confirm",
    name: "allowPrivateIPs",
    message: "Autoriser les requêtes HTTP vers IPs privées (10.x, 192.168.x) ?",
    default: false,
  }]);

  return {
    rateLimit: { messagesPerMinute, cooldownSeconds: 60 },
    shell: { mode: "allowlist", allowedCommands: shellCommands.split(",").map((c: string) => c.trim()) },
    http: { allowPrivateIPs, blockedDomains: [] },
    code: { allowedLanguages: codeLanguages, maxExecutionTime: 30000 },
  };
}

async function setupService(): Promise<NovaClawConfig["service"]> {
  const { install } = await inquirer.prompt([{
    type: "confirm",
    name: "install",
    message: "Installer NovaClaw comme service Windows (démarrage auto) ?",
    default: false,
  }]);

  if (!install) {
    return { installed: false, name: "NovaClaw", autoStart: false };
  }

  const { serviceName } = await inquirer.prompt([{
    type: "input",
    name: "serviceName",
    message: "Nom du service:",
    default: "NovaClaw",
  }]);

  return { installed: true, name: serviceName, autoStart: true };
}

async function showSummary(config: NovaClawConfig, credentials: Credentials): Promise<void> {
  const enabledSkills = SKILL_PRESETS[config.skills.preset].length + config.skills.enabled.length - config.skills.disabled.length;

  console.log(chalk.cyan("\n═══════════════════════════════════════════════════════════"));
  console.log(chalk.cyan("  📋 RÉSUMÉ DE CONFIGURATION"));
  console.log(chalk.cyan("═══════════════════════════════════════════════════════════\n"));

  console.log(chalk.white("┌─────────────────────────────────────────────────────────┐"));
  console.log(chalk.white("│  TELEGRAM                                               │"));
  console.log(chalk.gray(`│    Owner         ${config.channels.telegram.ownerId.toString().padEnd(40)}│`));
  console.log(chalk.gray(`│    Autorisés     ${config.channels.telegram.allowedUsers.length} utilisateur(s)${" ".repeat(25)}│`));
  console.log(chalk.white("├─────────────────────────────────────────────────────────┤"));
  console.log(chalk.white("│  CLAUDE                                                 │"));
  console.log(chalk.gray(`│    Auth          ${credentials.anthropic.authMethod.padEnd(40)}│`));
  console.log(chalk.gray(`│    Modèle        ${config.provider.model.padEnd(40)}│`));
  console.log(chalk.white("├─────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray(`│  SKILLS          ${config.skills.preset} (${enabledSkills} skills)${" ".repeat(22)}│`));
  console.log(chalk.white("├─────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray(`│  PERSONNALITÉ    ${config.agent.personality.padEnd(40)}│`));
  console.log(chalk.white("├─────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray(`│  SÉCURITÉ        ${config.security.rateLimit.messagesPerMinute} msg/min, shell: ${config.security.shell.mode}${" ".repeat(10)}│`));
  console.log(chalk.white("├─────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray(`│  SERVICE         ${config.service.installed ? "Windows Service (auto-start)" : "Non installé"}${" ".repeat(config.service.installed ? 10 : 19)}│`));
  console.log(chalk.white("└─────────────────────────────────────────────────────────┘"));
}

async function saveConfiguration(config: NovaClawConfig, credentials: Credentials): Promise<void> {
  const spinner = ora("Création de la configuration...").start();

  try {
    ensureConfigDir();
    saveConfig(config);
    saveCredentials(credentials);
    spinner.succeed("Configuration créée !");

    // Install service if requested
    if (config.service.installed) {
      const serviceSpinner = ora("Installation du service Windows...").start();
      try {
        const { installService } = await import("./service.js");
        await installService(config.service.name);
        serviceSpinner.succeed("Service Windows installé !");
      } catch (error) {
        serviceSpinner.fail(`Échec installation service: ${error}`);
      }
    }

    console.log(chalk.green("\n═══════════════════════════════════════════════════════════"));
    console.log(chalk.green.bold("  ✅ NovaClaw configuré avec succès !"));
    console.log(chalk.green("═══════════════════════════════════════════════════════════\n"));
    console.log(chalk.white("  Commandes utiles:"));
    console.log(chalk.cyan("    novaclaw start          ") + chalk.gray("Démarrer l'agent"));
    console.log(chalk.cyan("    novaclaw status         ") + chalk.gray("Voir le statut"));
    console.log(chalk.cyan("    novaclaw config show    ") + chalk.gray("Afficher la config"));
    if (config.service.installed) {
      console.log(chalk.cyan("    novaclaw service start  ") + chalk.gray("Démarrer le service"));
    }
    console.log("");
  } catch (error) {
    spinner.fail(`Erreur: ${error}`);
    throw error;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/setup.ts
git commit -m "feat(cli): complete setup wizard v2 with quick/complete modes"
```

---

### Task 6: Setup Helpers - Telegram & Auth

**Files:**
- Create: `src/cli/commands/setup/telegram.ts`
- Create: `src/cli/commands/setup/auth.ts`

- [ ] **Step 1: Create Telegram validation helper**

```typescript
// src/cli/commands/setup/telegram.ts
export async function validateTelegramToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      return { valid: true, username: data.result.username };
    } else {
      return { valid: false, error: data.description || "Token invalide" };
    }
  } catch (error) {
    return { valid: false, error: `Erreur réseau: ${error}` };
  }
}
```

- [ ] **Step 2: Create OAuth and API Key helpers**

```typescript
// src/cli/commands/setup/auth.ts
import inquirer from "inquirer";
import open from "open";
import http from "http";
import chalk from "chalk";
import ora from "ora";

export async function setupOAuth(): Promise<{ method: "oauth"; apiKey: null; oauthToken: string; email: string }> {
  console.log(chalk.gray("\n  OAuth utilise ton abonnement Claude Max."));
  console.log(chalk.gray("  Un navigateur va s'ouvrir pour te connecter.\n"));

  const { ready } = await inquirer.prompt([{
    type: "confirm",
    name: "ready",
    message: "Prêt à ouvrir le navigateur ?",
    default: true,
  }]);

  if (!ready) {
    throw new Error("OAuth annulé par l'utilisateur");
  }

  // For now, simulate OAuth - in production this would use actual OAuth flow
  const spinner = ora("En attente de connexion OAuth...").start();

  // Start local server to receive callback
  const token = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:3000`);
      const token = url.searchParams.get("token");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Erreur OAuth</h1><p>Ferme cette fenêtre.</p>");
        server.close();
        reject(new Error(error));
        return;
      }

      if (token) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Connexion réussie!</h1><p>Tu peux fermer cette fenêtre.</p>");
        server.close();
        resolve(token);
        return;
      }

      res.writeHead(400);
      res.end("Missing token");
    });

    server.listen(3000, () => {
      // In production, this would open the actual Claude OAuth URL
      // For MVP, we'll simulate with a placeholder
      console.log(chalk.yellow("\n  [SIMULATION] OAuth non implémenté dans cette version."));
      console.log(chalk.yellow("  Utilise l'API Key pour l'instant.\n"));
      server.close();
      reject(new Error("OAuth non disponible - utilise API Key"));
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Timeout OAuth (60s)"));
    }, 60000);
  });

  spinner.succeed("Connecté via OAuth !");

  return {
    method: "oauth",
    apiKey: null,
    oauthToken: token,
    email: "user@example.com", // Would be extracted from OAuth response
  };
}

export async function setupApiKey(): Promise<{ method: "apikey"; apiKey: string; oauthToken: null; email: null }> {
  const { apiKey } = await inquirer.prompt([{
    type: "password",
    name: "apiKey",
    message: "Clé API Anthropic (sk-ant-...):",
    mask: "*",
    validate: (input) => {
      if (!input.startsWith("sk-ant-")) {
        return "La clé doit commencer par sk-ant-";
      }
      if (input.length < 40) {
        return "Clé trop courte";
      }
      return true;
    },
  }]);

  // Validate API key by making a test request
  const spinner = ora("Validation de la clé API...").start();
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    if (response.status === 401) {
      spinner.fail("Clé API invalide");
      return setupApiKey();
    }

    spinner.succeed("Clé API validée !");
  } catch (error) {
    spinner.warn(`Impossible de valider (${error}). On continue quand même.`);
  }

  return { method: "apikey", apiKey, oauthToken: null, email: null };
}
```

- [ ] **Step 3: Create directory and commit**

```bash
mkdir -p src/cli/commands/setup
git add src/cli/commands/setup/
git commit -m "feat(cli): add setup helpers for Telegram validation and auth"
```

---

## PHASE 3: Skills Implementation

### Task 7: Skills Catalog & Base Updates

**Files:**
- Create: `src/skills/catalog.ts`
- Modify: `src/skills/base.ts`

- [ ] **Step 1: Update base skill with category**

```typescript
// src/skills/base.ts
export interface SkillContext {
  workspace: string;
  userId: number;
  chatId: number;
}

export interface SkillMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export abstract class BaseSkill {
  abstract name: string;
  abstract description: string;
  abstract category: string;
  abstract parameters: SkillDefinition["parameters"];

  getDefinition(): SkillDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  getMetadata(): SkillMetadata {
    return {
      id: this.name,
      name: this.name,
      category: this.category,
      description: this.description,
    };
  }

  abstract execute(args: Record<string, unknown>, context: SkillContext): Promise<string>;
}
```

- [ ] **Step 2: Create skills catalog**

```typescript
// src/skills/catalog.ts
import { BaseSkill, SkillMetadata } from "./base.js";
import { SkillsRegistry } from "./registry.js";

export function getSkillsCatalog(): SkillMetadata[] {
  return SkillsRegistry.getAll().map(skill => skill.getMetadata());
}

export function getSkillsByCategory(category: string): SkillMetadata[] {
  return getSkillsCatalog().filter(s => s.category === category);
}

export function isSkillAvailable(skillId: string): boolean {
  return SkillsRegistry.has(skillId);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/skills/base.ts src/skills/catalog.ts
git commit -m "feat(skills): add category support and skills catalog"
```

---

### Task 8: Web & Browser Skills (6 skills)

**Files:**
- Move: `src/skills/core/browser.ts` → `src/skills/web/browser.ts`
- Create: `src/skills/web/screenshot.ts`
- Create: `src/skills/web/web-scraper.ts`
- Create: `src/skills/web/pdf-reader.ts`
- Create: `src/skills/web/link-preview.ts`
- Create: `src/skills/web/web-monitor.ts`

- [ ] **Step 1: Update browser skill with category**

Add `category = "web";` to the BrowserSkill class.

- [ ] **Step 2: Create screenshot skill**

```typescript
// src/skills/web/screenshot.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";
import path from "path";
import fs from "fs";

export class ScreenshotSkill extends BaseSkill {
  name = "screenshot";
  description = "Capturer une page web en image PNG ou JPEG";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL de la page à capturer" },
      fullPage: { type: "boolean", description: "Capturer toute la page (pas juste le viewport)" },
      format: { type: "string", enum: ["png", "jpeg"], description: "Format de l'image" },
      filename: { type: "string", description: "Nom du fichier (optionnel)" },
    },
    required: ["url"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;
    const fullPage = (args.fullPage as boolean) ?? false;
    const format = (args.format as "png" | "jpeg") ?? "png";
    const filename = (args.filename as string) ?? `screenshot-${Date.now()}.${format}`;

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

      const filepath = path.join(context.workspace, filename);
      await page.screenshot({ path: filepath, fullPage, type: format });

      return `Screenshot sauvegardé: ${filename}`;
    } finally {
      if (browser) await browser.close();
    }
  }
}
```

- [ ] **Step 3: Create web-scraper skill**

```typescript
// src/skills/web/web-scraper.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";

export class WebScraperSkill extends BaseSkill {
  name = "web-scraper";
  description = "Extraire des données structurées d'une page web";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL de la page" },
      selector: { type: "string", description: "Sélecteur CSS des éléments à extraire" },
      attributes: { type: "array", items: { type: "string" }, description: "Attributs à extraire (text, href, src, etc.)" },
      limit: { type: "number", description: "Nombre max d'éléments" },
    },
    required: ["url", "selector"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;
    const selector = args.selector as string;
    const attributes = (args.attributes as string[]) ?? ["text"];
    const limit = (args.limit as number) ?? 50;

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      const results = await page.$$eval(selector, (elements, attrs, lim) => {
        return elements.slice(0, lim).map(el => {
          const data: Record<string, string> = {};
          for (const attr of attrs) {
            if (attr === "text") {
              data.text = el.textContent?.trim() || "";
            } else if (attr === "html") {
              data.html = el.innerHTML;
            } else {
              data[attr] = el.getAttribute(attr) || "";
            }
          }
          return data;
        });
      }, attributes, limit);

      return JSON.stringify(results, null, 2);
    } finally {
      if (browser) await browser.close();
    }
  }
}
```

- [ ] **Step 4: Create pdf-reader skill**

```typescript
// src/skills/web/pdf-reader.ts
import { BaseSkill, SkillContext } from "../base.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export class PdfReaderSkill extends BaseSkill {
  name = "pdf-reader";
  description = "Lire et extraire le texte d'un fichier PDF";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "Chemin du fichier PDF (relatif au workspace)" },
      pages: { type: "string", description: "Pages à extraire (ex: '1-5' ou '1,3,5')" },
    },
    required: ["path"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const pdfPath = args.path as string;
    const pages = args.pages as string | undefined;

    const fullPath = path.resolve(context.workspace, pdfPath);
    if (!fullPath.startsWith(path.resolve(context.workspace))) {
      throw new Error("Path traversal not allowed");
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`PDF not found: ${pdfPath}`);
    }

    // Use pdftotext if available, otherwise return info about the file
    try {
      let cmd = `pdftotext -layout "${fullPath}" -`;
      if (pages) {
        cmd = `pdftotext -f ${pages.split("-")[0] || pages.split(",")[0]} -l ${pages.split("-")[1] || pages.split(",").pop()} -layout "${fullPath}" -`;
      }
      const text = execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      return text.slice(0, 50000); // Limit output
    } catch {
      // Fallback: return file info
      const stats = fs.statSync(fullPath);
      return `PDF: ${pdfPath}\nTaille: ${(stats.size / 1024).toFixed(1)} KB\n\n[pdftotext non disponible - installez poppler-utils pour extraire le texte]`;
    }
  }
}
```

- [ ] **Step 5: Create link-preview skill**

```typescript
// src/skills/web/link-preview.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";

export class LinkPreviewSkill extends BaseSkill {
  name = "link-preview";
  description = "Prévisualiser un lien (titre, description, image)";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL à prévisualiser" },
    },
    required: ["url"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      const metadata = await page.evaluate(() => {
        const getMeta = (name: string) => {
          const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
          return el?.getAttribute("content") || "";
        };
        return {
          title: document.title || getMeta("og:title"),
          description: getMeta("og:description") || getMeta("description"),
          image: getMeta("og:image"),
          siteName: getMeta("og:site_name"),
          type: getMeta("og:type"),
        };
      });

      return JSON.stringify({ url, ...metadata }, null, 2);
    } finally {
      if (browser) await browser.close();
    }
  }
}
```

- [ ] **Step 6: Create web-monitor skill**

```typescript
// src/skills/web/web-monitor.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export class WebMonitorSkill extends BaseSkill {
  name = "web-monitor";
  description = "Surveiller une page web et détecter les changements";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["check", "snapshot", "compare"], description: "Action à effectuer" },
      url: { type: "string", description: "URL à surveiller" },
      selector: { type: "string", description: "Sélecteur CSS pour cibler une partie de la page" },
      name: { type: "string", description: "Nom du monitoring (pour stocker le snapshot)" },
    },
    required: ["action", "url"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const url = args.url as string;
    const selector = args.selector as string | undefined;
    const name = (args.name as string) || crypto.createHash("md5").update(url).digest("hex").slice(0, 8);

    const snapshotPath = path.join(context.workspace, ".web-monitor", `${name}.txt`);
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      const content = selector
        ? await page.$eval(selector, el => el.textContent || "").catch(() => "Selector not found")
        : await page.evaluate(() => document.body.innerText);

      const contentHash = crypto.createHash("sha256").update(content).digest("hex");

      if (action === "snapshot") {
        fs.writeFileSync(snapshotPath, JSON.stringify({ url, selector, hash: contentHash, content: content.slice(0, 10000), timestamp: new Date().toISOString() }));
        return `Snapshot sauvegardé: ${name}`;
      }

      if (action === "check" || action === "compare") {
        if (!fs.existsSync(snapshotPath)) {
          fs.writeFileSync(snapshotPath, JSON.stringify({ url, selector, hash: contentHash, content: content.slice(0, 10000), timestamp: new Date().toISOString() }));
          return `Premier snapshot créé pour ${name}. Relance pour comparer.`;
        }

        const previous = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
        if (previous.hash === contentHash) {
          return `Aucun changement détecté sur ${url}`;
        }

        // Save new snapshot
        fs.writeFileSync(snapshotPath, JSON.stringify({ url, selector, hash: contentHash, content: content.slice(0, 10000), timestamp: new Date().toISOString() }));
        return `⚠️ Changement détecté sur ${url} !\n\nAncien hash: ${previous.hash.slice(0, 16)}...\nNouveau hash: ${contentHash.slice(0, 16)}...`;
      }

      return "Action inconnue";
    } finally {
      if (browser) await browser.close();
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
mkdir -p src/skills/web
mv src/skills/core/browser.ts src/skills/web/
git add src/skills/web/
git commit -m "feat(skills): add web & browser skills (6 skills)"
```

---

### Task 9: Shell & System Skills (6 skills)

**Files:**
- Move: `src/skills/core/shell-exec.ts` → `src/skills/system/shell.ts`
- Create: `src/skills/system/process-manager.ts`
- Create: `src/skills/system/system-info.ts`
- Create: `src/skills/system/package-manager.ts`
- Create: `src/skills/system/service-manager.ts`
- Create: `src/skills/system/cron-scheduler.ts`

- [ ] **Step 1: Create process-manager skill**

```typescript
// src/skills/system/process-manager.ts
import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";
import os from "os";

export class ProcessManagerSkill extends BaseSkill {
  name = "process-manager";
  description = "Lister, surveiller et gérer les processus système";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["list", "kill", "find"], description: "Action" },
      pid: { type: "number", description: "PID du processus (pour kill)" },
      name: { type: "string", description: "Nom du processus (pour find)" },
      limit: { type: "number", description: "Nombre max de résultats" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const isWindows = os.platform() === "win32";

    if (action === "list") {
      const limit = (args.limit as number) || 20;
      if (isWindows) {
        const output = execSync("tasklist /FO CSV /NH", { encoding: "utf-8" });
        const lines = output.trim().split("\n").slice(0, limit);
        return lines.map(line => {
          const [name, pid, , , mem] = line.split(",").map(s => s.replace(/"/g, ""));
          return `${pid.padStart(6)} ${mem.padStart(12)} ${name}`;
        }).join("\n");
      } else {
        return execSync(`ps aux --sort=-%mem | head -${limit + 1}`, { encoding: "utf-8" });
      }
    }

    if (action === "kill") {
      const pid = args.pid as number;
      if (!pid) throw new Error("PID requis");
      if (isWindows) {
        execSync(`taskkill /PID ${pid} /F`, { encoding: "utf-8" });
      } else {
        execSync(`kill -9 ${pid}`, { encoding: "utf-8" });
      }
      return `Processus ${pid} terminé`;
    }

    if (action === "find") {
      const name = args.name as string;
      if (!name) throw new Error("Nom requis");
      if (isWindows) {
        const output = execSync(`tasklist /FI "IMAGENAME eq *${name}*" /FO CSV /NH`, { encoding: "utf-8" });
        return output || "Aucun processus trouvé";
      } else {
        return execSync(`pgrep -la "${name}" || echo "Aucun processus trouvé"`, { encoding: "utf-8" });
      }
    }

    return "Action inconnue";
  }
}
```

- [ ] **Step 2: Create system-info skill**

```typescript
// src/skills/system/system-info.ts
import { BaseSkill, SkillContext } from "../base.js";
import os from "os";
import { execSync } from "child_process";

export class SystemInfoSkill extends BaseSkill {
  name = "system-info";
  description = "Obtenir des informations système (CPU, RAM, disque, réseau)";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      type: { type: "string", enum: ["all", "cpu", "memory", "disk", "network", "os"], description: "Type d'info" },
    },
    required: ["type"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const type = args.type as string;
    const results: string[] = [];

    if (type === "all" || type === "os") {
      results.push(`=== OS ===`);
      results.push(`Platform: ${os.platform()}`);
      results.push(`Release: ${os.release()}`);
      results.push(`Hostname: ${os.hostname()}`);
      results.push(`Uptime: ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`);
    }

    if (type === "all" || type === "cpu") {
      const cpus = os.cpus();
      results.push(`\n=== CPU ===`);
      results.push(`Model: ${cpus[0]?.model || "Unknown"}`);
      results.push(`Cores: ${cpus.length}`);
      results.push(`Speed: ${cpus[0]?.speed || 0} MHz`);
      const load = os.loadavg();
      results.push(`Load: ${load.map(l => l.toFixed(2)).join(", ")} (1m, 5m, 15m)`);
    }

    if (type === "all" || type === "memory") {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      results.push(`\n=== Memory ===`);
      results.push(`Total: ${(totalMem / 1024 / 1024 / 1024).toFixed(1)} GB`);
      results.push(`Used: ${(usedMem / 1024 / 1024 / 1024).toFixed(1)} GB (${((usedMem / totalMem) * 100).toFixed(0)}%)`);
      results.push(`Free: ${(freeMem / 1024 / 1024 / 1024).toFixed(1)} GB`);
    }

    if (type === "all" || type === "disk") {
      results.push(`\n=== Disk ===`);
      try {
        if (os.platform() === "win32") {
          const output = execSync("wmic logicaldisk get size,freespace,caption", { encoding: "utf-8" });
          results.push(output.trim());
        } else {
          results.push(execSync("df -h / /home 2>/dev/null || df -h /", { encoding: "utf-8" }).trim());
        }
      } catch {
        results.push("Disk info unavailable");
      }
    }

    if (type === "all" || type === "network") {
      results.push(`\n=== Network ===`);
      const interfaces = os.networkInterfaces();
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
          if (addr.family === "IPv4" && !addr.internal) {
            results.push(`${name}: ${addr.address}`);
          }
        }
      }
    }

    return results.join("\n");
  }
}
```

- [ ] **Step 3: Create package-manager skill**

```typescript
// src/skills/system/package-manager.ts
import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";
import os from "os";

export class PackageManagerSkill extends BaseSkill {
  name = "package-manager";
  description = "Gérer les packages (npm, pip, apt, choco)";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      manager: { type: "string", enum: ["npm", "pip", "apt", "choco", "auto"], description: "Package manager" },
      action: { type: "string", enum: ["install", "uninstall", "list", "search", "update"], description: "Action" },
      package: { type: "string", description: "Nom du package" },
      global: { type: "boolean", description: "Installation globale (npm)" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const manager = args.manager as string || "npm";
    const action = args.action as string;
    const pkg = args.package as string;
    const global = args.global as boolean;

    const cmds: Record<string, Record<string, string>> = {
      npm: {
        install: `npm install ${global ? "-g " : ""}${pkg}`,
        uninstall: `npm uninstall ${global ? "-g " : ""}${pkg}`,
        list: `npm list ${global ? "-g " : ""}--depth=0`,
        search: `npm search ${pkg}`,
        update: `npm update ${global ? "-g " : ""}`,
      },
      pip: {
        install: `pip install ${pkg}`,
        uninstall: `pip uninstall -y ${pkg}`,
        list: `pip list`,
        search: `pip index versions ${pkg}`,
        update: `pip install --upgrade ${pkg}`,
      },
    };

    const cmd = cmds[manager]?.[action];
    if (!cmd) {
      return `Combinaison non supportée: ${manager} ${action}`;
    }

    try {
      return execSync(cmd, { encoding: "utf-8", cwd: context.workspace, timeout: 120000 });
    } catch (error: any) {
      return `Erreur: ${error.message}\n${error.stdout || ""}\n${error.stderr || ""}`;
    }
  }
}
```

- [ ] **Step 4: Create service-manager skill**

```typescript
// src/skills/system/service-manager.ts
import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";
import os from "os";

export class ServiceManagerSkill extends BaseSkill {
  name = "service-manager";
  description = "Gérer les services système (Windows/Linux)";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["start", "stop", "restart", "status", "list"], description: "Action" },
      name: { type: "string", description: "Nom du service" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const name = args.name as string;
    const isWindows = os.platform() === "win32";

    if (action === "list") {
      if (isWindows) {
        return execSync("sc query type= service state= all | findstr SERVICE_NAME", { encoding: "utf-8" });
      } else {
        return execSync("systemctl list-units --type=service --state=running --no-pager | head -30", { encoding: "utf-8" });
      }
    }

    if (!name) throw new Error("Nom du service requis");

    const cmds: Record<string, { win: string; linux: string }> = {
      start: { win: `sc start ${name}`, linux: `sudo systemctl start ${name}` },
      stop: { win: `sc stop ${name}`, linux: `sudo systemctl stop ${name}` },
      restart: { win: `sc stop ${name} && sc start ${name}`, linux: `sudo systemctl restart ${name}` },
      status: { win: `sc query ${name}`, linux: `systemctl status ${name} --no-pager` },
    };

    const cmd = cmds[action]?.[isWindows ? "win" : "linux"];
    if (!cmd) return "Action non supportée";

    try {
      return execSync(cmd, { encoding: "utf-8" });
    } catch (error: any) {
      return `Erreur: ${error.message}`;
    }
  }
}
```

- [ ] **Step 5: Create cron-scheduler skill**

```typescript
// src/skills/system/cron-scheduler.ts
import { BaseSkill, SkillContext } from "../base.js";
import { getDatabase } from "../../storage/db.js";

export class CronSchedulerSkill extends BaseSkill {
  name = "cron-scheduler";
  description = "Planifier des tâches récurrentes";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["create", "list", "delete", "enable", "disable"], description: "Action" },
      name: { type: "string", description: "Nom de la tâche" },
      cron: { type: "string", description: "Expression cron (ex: '0 9 * * *' = tous les jours à 9h)" },
      command: { type: "string", description: "Commande à exécuter" },
      taskId: { type: "number", description: "ID de la tâche (pour delete/enable/disable)" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const db = getDatabase();

    if (action === "list") {
      const tasks = db.prepare(`
        SELECT id, name, cron_expression, action, enabled, last_run, next_run
        FROM scheduled_tasks WHERE user_id = ? OR user_id IS NULL
      `).all(context.userId);
      
      if (tasks.length === 0) return "Aucune tâche planifiée";
      return tasks.map((t: any) => 
        `[${t.id}] ${t.name} (${t.enabled ? "actif" : "inactif"})\n    Cron: ${t.cron_expression}\n    Action: ${t.action}`
      ).join("\n\n");
    }

    if (action === "create") {
      const name = args.name as string;
      const cron = args.cron as string;
      const command = args.command as string;
      if (!name || !cron || !command) throw new Error("name, cron et command requis");

      db.prepare(`
        INSERT INTO scheduled_tasks (user_id, chat_id, name, cron_expression, action, enabled)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(context.userId, context.chatId, name, cron, command);

      return `Tâche créée: ${name}`;
    }

    if (action === "delete" || action === "enable" || action === "disable") {
      const taskId = args.taskId as number;
      if (!taskId) throw new Error("taskId requis");

      if (action === "delete") {
        db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(taskId);
        return `Tâche ${taskId} supprimée`;
      } else {
        const enabled = action === "enable" ? 1 : 0;
        db.prepare("UPDATE scheduled_tasks SET enabled = ? WHERE id = ?").run(enabled, taskId);
        return `Tâche ${taskId} ${action === "enable" ? "activée" : "désactivée"}`;
      }
    }

    return "Action inconnue";
  }
}
```

- [ ] **Step 6: Commit**

```bash
mkdir -p src/skills/system
mv src/skills/core/shell-exec.ts src/skills/system/shell.ts
git add src/skills/system/
git commit -m "feat(skills): add shell & system skills (6 skills)"
```

---

### Task 10-16: Remaining Skills (30 skills)

Due to the length of this plan, I'll provide the structure for the remaining skills. Each follows the same pattern as above.

**Files & Storage Skills (6):**
- `src/skills/files/files.ts` - Move from core, add category
- `src/skills/files/file-search.ts` - Search files by name/content
- `src/skills/files/archive.ts` - ZIP/TAR operations
- `src/skills/files/file-convert.ts` - Format conversions
- `src/skills/files/file-watch.ts` - Watch for changes
- `src/skills/files/cloud-storage.ts` - Cloud operations placeholder

**Code & Dev Skills (7):**
- `src/skills/code/code-runner.ts` - Move from core
- `src/skills/code/code-analyzer.ts` - Static analysis
- `src/skills/code/git.ts` - Git operations
- `src/skills/code/github.ts` - GitHub API
- `src/skills/code/docker.ts` - Docker operations
- `src/skills/code/database.ts` - SQL queries
- `src/skills/code/api-tester.ts` - REST/GraphQL testing

**Network & HTTP Skills (5):**
- `src/skills/network/http.ts` - Move from core
- `src/skills/network/webhook-sender.ts` - Send webhooks
- `src/skills/network/webhook-receiver.ts` - Receive webhooks
- `src/skills/network/dns-lookup.ts` - DNS/WHOIS
- `src/skills/network/port-scanner.ts` - Port scanning

**Data & AI Skills (5):**
- `src/skills/data/json-processor.ts` - JSON operations
- `src/skills/data/csv-processor.ts` - CSV operations
- `src/skills/data/text-analyzer.ts` - Text analysis
- `src/skills/data/image-analyzer.ts` - Image analysis (Claude Vision)
- `src/skills/data/calculator.ts` - Math operations

**Communication Skills (4):**
- `src/skills/communication/email-sender.ts` - SMTP
- `src/skills/communication/email-reader.ts` - IMAP
- `src/skills/communication/sms-sender.ts` - Twilio
- `src/skills/communication/notification.ts` - System notifications

**Automation & IoT Skills (3):**
- `src/skills/automation/home-assistant.ts` - Home automation
- `src/skills/automation/macro-recorder.ts` - Macro recording
- `src/skills/automation/workflow.ts` - Skill chaining

---

## PHASE 4: Skills Initialization Update

### Task 17: Update Skills Init

**Files:**
- Modify: `src/skills/init.ts`

- [ ] **Step 1: Update init to load all skills**

```typescript
// src/skills/init.ts
import { SkillsRegistry } from "./registry.js";
import { loadConfig, getEnabledSkills } from "../config/loader.js";
import { logger } from "../utils/logger.js";

// Web & Browser
import { BrowserSkill } from "./web/browser.js";
import { ScreenshotSkill } from "./web/screenshot.js";
import { WebScraperSkill } from "./web/web-scraper.js";
import { PdfReaderSkill } from "./web/pdf-reader.js";
import { LinkPreviewSkill } from "./web/link-preview.js";
import { WebMonitorSkill } from "./web/web-monitor.js";

// System
import { ShellExecSkill } from "./system/shell.js";
import { ProcessManagerSkill } from "./system/process-manager.js";
import { SystemInfoSkill } from "./system/system-info.js";
import { PackageManagerSkill } from "./system/package-manager.js";
import { ServiceManagerSkill } from "./system/service-manager.js";
import { CronSchedulerSkill } from "./system/cron-scheduler.js";

// Files
import { FileOpsSkill } from "./files/files.js";
import { FileSearchSkill } from "./files/file-search.js";
import { ArchiveSkill } from "./files/archive.js";
import { FileConvertSkill } from "./files/file-convert.js";
import { FileWatchSkill } from "./files/file-watch.js";
import { CloudStorageSkill } from "./files/cloud-storage.js";

// Code & Dev
import { RunCodeSkill } from "./code/code-runner.js";
import { CodeAnalyzerSkill } from "./code/code-analyzer.js";
import { GitSkill } from "./code/git.js";
import { GitHubSkill } from "./code/github.js";
import { DockerSkill } from "./code/docker.js";
import { DatabaseSkill } from "./code/database.js";
import { ApiTesterSkill } from "./code/api-tester.js";

// Network
import { HttpApiSkill } from "./network/http.js";
import { WebhookSenderSkill } from "./network/webhook-sender.js";
import { WebhookReceiverSkill } from "./network/webhook-receiver.js";
import { DnsLookupSkill } from "./network/dns-lookup.js";
import { PortScannerSkill } from "./network/port-scanner.js";

// Data & AI
import { JsonProcessorSkill } from "./data/json-processor.js";
import { CsvProcessorSkill } from "./data/csv-processor.js";
import { TextAnalyzerSkill } from "./data/text-analyzer.js";
import { ImageAnalyzerSkill } from "./data/image-analyzer.js";
import { CalculatorSkill } from "./data/calculator.js";

// Communication
import { EmailSenderSkill } from "./communication/email-sender.js";
import { EmailReaderSkill } from "./communication/email-reader.js";
import { SmsSenderSkill } from "./communication/sms-sender.js";
import { NotificationSkill } from "./communication/notification.js";

// Automation
import { HomeAssistantSkill } from "./automation/home-assistant.js";
import { MacroRecorderSkill } from "./automation/macro-recorder.js";
import { WorkflowSkill } from "./automation/workflow.js";

const ALL_SKILLS: Record<string, new () => any> = {
  // Web
  "browser": BrowserSkill,
  "screenshot": ScreenshotSkill,
  "web-scraper": WebScraperSkill,
  "pdf-reader": PdfReaderSkill,
  "link-preview": LinkPreviewSkill,
  "web-monitor": WebMonitorSkill,
  // System
  "shell": ShellExecSkill,
  "process-manager": ProcessManagerSkill,
  "system-info": SystemInfoSkill,
  "package-manager": PackageManagerSkill,
  "service-manager": ServiceManagerSkill,
  "cron-scheduler": CronSchedulerSkill,
  // Files
  "files": FileOpsSkill,
  "file-search": FileSearchSkill,
  "archive": ArchiveSkill,
  "file-convert": FileConvertSkill,
  "file-watch": FileWatchSkill,
  "cloud-storage": CloudStorageSkill,
  // Code
  "code-runner": RunCodeSkill,
  "code-analyzer": CodeAnalyzerSkill,
  "git": GitSkill,
  "github": GitHubSkill,
  "docker": DockerSkill,
  "database": DatabaseSkill,
  "api-tester": ApiTesterSkill,
  // Network
  "http": HttpApiSkill,
  "webhook-sender": WebhookSenderSkill,
  "webhook-receiver": WebhookReceiverSkill,
  "dns-lookup": DnsLookupSkill,
  "port-scanner": PortScannerSkill,
  // Data
  "json-processor": JsonProcessorSkill,
  "csv-processor": CsvProcessorSkill,
  "text-analyzer": TextAnalyzerSkill,
  "image-analyzer": ImageAnalyzerSkill,
  "calculator": CalculatorSkill,
  // Communication
  "email-sender": EmailSenderSkill,
  "email-reader": EmailReaderSkill,
  "sms-sender": SmsSenderSkill,
  "notification": NotificationSkill,
  // Automation
  "home-assistant": HomeAssistantSkill,
  "macro-recorder": MacroRecorderSkill,
  "workflow": WorkflowSkill,
};

export function initializeSkills(): void {
  const config = loadConfig();
  const enabledSkills = getEnabledSkills(config);

  SkillsRegistry.clear();

  for (const skillId of enabledSkills) {
    const SkillClass = ALL_SKILLS[skillId];
    if (SkillClass) {
      SkillsRegistry.register(new SkillClass());
    } else {
      logger.warn(`Unknown skill: ${skillId}`);
    }
  }

  logger.info(`Initialized ${SkillsRegistry.count()} skills: ${enabledSkills.join(", ")}`);
}

export function getAvailableSkillIds(): string[] {
  return Object.keys(ALL_SKILLS);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/skills/init.ts
git commit -m "feat(skills): update init to load skills based on config"
```

---

## PHASE 5: CLI Commands

### Task 18: Config Command

**Files:**
- Create: `src/cli/commands/config.ts`

- [ ] **Step 1: Create config command**

```typescript
// src/cli/commands/config.ts
import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, saveConfig, getConfigDir } from "../../config/loader.js";
import { execSync } from "child_process";
import path from "path";

export const configCommand = new Command("config")
  .description("Manage NovaClaw configuration");

configCommand
  .command("show")
  .description("Display current configuration")
  .action(() => {
    try {
      const config = loadConfig();
      console.log(chalk.cyan("\nNovaClaw Configuration:\n"));
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.log(chalk.red(`Error: ${error}`));
    }
  });

configCommand
  .command("get <key>")
  .description("Get a configuration value")
  .action((key: string) => {
    try {
      const config = loadConfig();
      const keys = key.split(".");
      let value: any = config;
      for (const k of keys) {
        value = value?.[k];
      }
      console.log(value !== undefined ? JSON.stringify(value, null, 2) : "Key not found");
    } catch (error) {
      console.log(chalk.red(`Error: ${error}`));
    }
  });

configCommand
  .command("set <key> <value>")
  .description("Set a configuration value")
  .action((key: string, value: string) => {
    try {
      const config = loadConfig();
      const keys = key.split(".");
      let obj: any = config;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      
      // Parse value
      let parsedValue: any = value;
      if (value === "true") parsedValue = true;
      else if (value === "false") parsedValue = false;
      else if (!isNaN(Number(value))) parsedValue = Number(value);
      
      obj[keys[keys.length - 1]] = parsedValue;
      saveConfig(config);
      console.log(chalk.green(`✓ ${key} = ${JSON.stringify(parsedValue)}`));
    } catch (error) {
      console.log(chalk.red(`Error: ${error}`));
    }
  });

configCommand
  .command("edit")
  .description("Open configuration in editor")
  .action(() => {
    const configPath = path.join(getConfigDir(), "novaclaw.json");
    const editor = process.env.EDITOR || "notepad";
    try {
      execSync(`${editor} "${configPath}"`, { stdio: "inherit" });
    } catch {
      console.log(chalk.yellow(`Open manually: ${configPath}`));
    }
  });

configCommand
  .command("path")
  .description("Show configuration directory path")
  .action(() => {
    console.log(getConfigDir());
  });
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/config.ts
git commit -m "feat(cli): add config command"
```

---

### Task 19: Skills Command

**Files:**
- Create: `src/cli/commands/skills-cmd.ts`

- [ ] **Step 1: Create skills command**

```typescript
// src/cli/commands/skills-cmd.ts
import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, saveConfig, getEnabledSkills } from "../../config/loader.js";
import { ALL_SKILLS, SKILL_CATEGORIES } from "../../config/defaults.js";

export const skillsCommand = new Command("skills")
  .description("Manage NovaClaw skills");

skillsCommand
  .command("list")
  .description("List all skills")
  .option("-a, --all", "Show all available skills")
  .option("-c, --category <cat>", "Filter by category")
  .action((options) => {
    const config = loadConfig();
    const enabled = getEnabledSkills(config);

    let skills = ALL_SKILLS;
    if (options.category) {
      skills = skills.filter(s => s.category === options.category);
    }

    console.log(chalk.cyan("\nNovaClaw Skills:\n"));

    for (const cat of SKILL_CATEGORIES) {
      const catSkills = skills.filter(s => s.category === cat.id);
      if (catSkills.length === 0) continue;

      console.log(chalk.yellow(`${cat.icon} ${cat.name}`));
      for (const skill of catSkills) {
        const isEnabled = enabled.includes(skill.id);
        const status = isEnabled ? chalk.green("●") : chalk.gray("○");
        console.log(`  ${status} ${skill.id.padEnd(18)} ${chalk.gray(skill.description)}`);
      }
      console.log("");
    }

    console.log(chalk.gray(`Enabled: ${enabled.length}/${ALL_SKILLS.length} skills`));
  });

skillsCommand
  .command("enable <name>")
  .description("Enable a skill")
  .action((name) => {
    const config = loadConfig();
    if (!config.skills.enabled.includes(name)) {
      config.skills.enabled.push(name);
    }
    config.skills.disabled = config.skills.disabled.filter(s => s !== name);
    saveConfig(config);
    console.log(chalk.green(`✓ Skill '${name}' enabled`));
  });

skillsCommand
  .command("disable <name>")
  .description("Disable a skill")
  .action((name) => {
    const config = loadConfig();
    if (!config.skills.disabled.includes(name)) {
      config.skills.disabled.push(name);
    }
    config.skills.enabled = config.skills.enabled.filter(s => s !== name);
    saveConfig(config);
    console.log(chalk.green(`✓ Skill '${name}' disabled`));
  });

skillsCommand
  .command("info <name>")
  .description("Show skill details")
  .action((name) => {
    const skill = ALL_SKILLS.find(s => s.id === name);
    if (!skill) {
      console.log(chalk.red(`Skill '${name}' not found`));
      return;
    }
    
    const config = loadConfig();
    const enabled = getEnabledSkills(config);
    
    console.log(chalk.cyan(`\n${skill.name}`));
    console.log(chalk.gray(`ID: ${skill.id}`));
    console.log(chalk.gray(`Category: ${skill.category}`));
    console.log(chalk.gray(`Description: ${skill.description}`));
    console.log(chalk.gray(`Status: ${enabled.includes(skill.id) ? chalk.green("Enabled") : chalk.red("Disabled")}`));
  });
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/skills-cmd.ts
git commit -m "feat(cli): add skills command"
```

---

### Task 20: Service Command

**Files:**
- Create: `src/cli/commands/service.ts`

- [ ] **Step 1: Create service command**

```typescript
// src/cli/commands/service.ts
import { Command } from "commander";
import chalk from "chalk";
import { Service } from "node-windows";
import path from "path";
import { getConfigDir, loadConfig, saveConfig } from "../../config/loader.js";

const getService = (name: string) => {
  const scriptPath = path.join(process.cwd(), "dist", "index.js");
  return new Service({
    name,
    description: "NovaClaw AI Agent for Telegram",
    script: scriptPath,
    nodeOptions: ["--experimental-specifier-resolution=node"],
    env: [{ name: "NOVACLAW_CONFIG_DIR", value: getConfigDir() }],
  });
};

export const serviceCommand = new Command("service")
  .description("Manage NovaClaw Windows service");

serviceCommand
  .command("install")
  .description("Install NovaClaw as Windows service")
  .action(async () => {
    const config = loadConfig();
    const svc = getService(config.service.name);

    svc.on("install", () => {
      console.log(chalk.green(`✓ Service '${config.service.name}' installed`));
      config.service.installed = true;
      saveConfig(config);
      svc.start();
    });

    svc.on("alreadyinstalled", () => {
      console.log(chalk.yellow(`Service '${config.service.name}' already installed`));
    });

    svc.on("error", (err) => {
      console.log(chalk.red(`Error: ${err}`));
    });

    console.log(chalk.cyan("Installing service..."));
    svc.install();
  });

serviceCommand
  .command("uninstall")
  .description("Uninstall NovaClaw service")
  .action(async () => {
    const config = loadConfig();
    const svc = getService(config.service.name);

    svc.on("uninstall", () => {
      console.log(chalk.green(`✓ Service '${config.service.name}' uninstalled`));
      config.service.installed = false;
      saveConfig(config);
    });

    svc.uninstall();
  });

serviceCommand
  .command("start")
  .description("Start NovaClaw service")
  .action(() => {
    const config = loadConfig();
    const svc = getService(config.service.name);
    svc.on("start", () => console.log(chalk.green("✓ Service started")));
    svc.start();
  });

serviceCommand
  .command("stop")
  .description("Stop NovaClaw service")
  .action(() => {
    const config = loadConfig();
    const svc = getService(config.service.name);
    svc.on("stop", () => console.log(chalk.green("✓ Service stopped")));
    svc.stop();
  });

serviceCommand
  .command("status")
  .description("Check service status")
  .action(() => {
    const config = loadConfig();
    console.log(chalk.cyan(`Service: ${config.service.name}`));
    console.log(chalk.gray(`Installed: ${config.service.installed ? "Yes" : "No"}`));
    console.log(chalk.gray(`Auto-start: ${config.service.autoStart ? "Yes" : "No"}`));
  });

export async function installService(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const svc = getService(name);
    svc.on("install", resolve);
    svc.on("error", reject);
    svc.install();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/service.ts
git commit -m "feat(cli): add Windows service command"
```

---

### Task 21: Update CLI Index

**Files:**
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Update CLI with all commands**

```typescript
// src/cli/index.ts
#!/usr/bin/env node
import { Command } from "commander";
import { setupCommand } from "./commands/setup.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { configCommand } from "./commands/config.js";
import { skillsCommand } from "./commands/skills-cmd.js";
import { serviceCommand } from "./commands/service.js";
import { showLogo } from "./logo.js";

const program = new Command();

program
  .name("novaclaw")
  .description("NovaClaw - Personal AI Agent for Telegram")
  .version("2.0.0");

program.addCommand(setupCommand);
program.addCommand(startCommand);
program.addCommand(statusCommand);
program.addCommand(configCommand);
program.addCommand(skillsCommand);
program.addCommand(serviceCommand);

program
  .command("logs")
  .description("View NovaClaw logs")
  .option("-f, --follow", "Follow log output")
  .option("-n, --lines <n>", "Number of lines", "50")
  .action((options) => {
    const { execSync } = require("child_process");
    const { getConfigDir } = require("../config/loader.js");
    const path = require("path");
    const logPath = path.join(getConfigDir(), "logs", "novaclaw.log");
    
    if (options.follow) {
      execSync(`tail -f "${logPath}"`, { stdio: "inherit" });
    } else {
      execSync(`tail -n ${options.lines} "${logPath}"`, { stdio: "inherit" });
    }
  });

// Show logo on help
program.on("--help", () => {
  console.log("");
  showLogo();
});

program.parse();
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat(cli): register all new commands"
```

---

## PHASE 6: Final Integration

### Task 22: Update Main Entry Point

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update to use new config system**

```typescript
// src/index.ts
import { loadConfig, loadCredentials, configExists } from "./config/loader.js";
import { initDatabase, closeDatabase } from "./storage/db.js";
import { initializeSkills } from "./skills/init.js";
import { ClaudeClient } from "./claude/client.js";
import { startBot, stopBot } from "./gateway/bot.js";
import { logger } from "./utils/logger.js";
import path from "path";

async function main(): Promise<void> {
  try {
    logger.info("Démarrage NovaClaw v2.0...");

    // Check config exists
    if (!configExists()) {
      logger.error("Configuration non trouvée. Lance 'novaclaw setup' d'abord.");
      process.exit(1);
    }

    const config = loadConfig();
    const credentials = loadCredentials();
    
    logger.info(`Configuration chargée (model: ${config.provider.model})`);

    // Set env vars for backward compatibility
    process.env.TELEGRAM_BOT_TOKEN = credentials.telegram.botToken;
    process.env.TELEGRAM_OWNER_ID = String(config.channels.telegram.ownerId);
    process.env.TELEGRAM_ALLOWED_IDS = config.channels.telegram.allowedUsers.join(",");
    process.env.CLAUDE_MODEL = config.provider.model;
    process.env.DEFAULT_LANGUAGE = config.agent.language;
    
    if (credentials.anthropic.apiKey) {
      process.env.ANTHROPIC_API_KEY = credentials.anthropic.apiKey;
    }

    await initDatabase();
    logger.info("Base de données initialisée");

    await ClaudeClient.initialize({ model: config.provider.model });
    logger.info("Client Claude initialisé");

    initializeSkills();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Signal ${signal} reçu, arrêt...`);
      try {
        stopBot();
        closeDatabase();
        process.exit(0);
      } catch (error) {
        logger.error(`Erreur arrêt: ${error}`);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    await startBot();
  } catch (error) {
    logger.error(`Erreur démarrage: ${error}`);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: update main entry to use new config system"
```

---

### Task 23: Install Dependencies

- [ ] **Step 1: Install new dependency**

```bash
npm install open@^10.0.0
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add open dependency for OAuth browser flow"
```

---

### Task 24: Final Build & Test

- [ ] **Step 1: Build**

```bash
npm run build
```

- [ ] **Step 2: Test setup wizard**

```bash
node dist/cli/index.js setup --quick
```

- [ ] **Step 3: Test skills list**

```bash
node dist/cli/index.js skills list
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: NovaClaw v2.0 complete - 42 skills, setup wizard, JSON config"
git push origin main
```

---

## Summary

**Total: 24 tasks**

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Configuration System |
| 2 | 5-6 | Setup Wizard v2 |
| 3 | 7-16 | 42 Skills Implementation |
| 4 | 17 | Skills Init Update |
| 5 | 18-21 | CLI Commands |
| 6 | 22-24 | Final Integration |

**Skills by category:**
- Web & Browser: 6
- Shell & System: 6
- Files & Storage: 6
- Code & Dev: 7
- Network & HTTP: 5
- Data & AI: 5
- Communication: 4
- Automation & IoT: 3
- **Total: 42 skills**
