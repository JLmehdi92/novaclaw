// src/cli/commands/config.ts
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import inquirer from "inquirer";
import {
  loadConfig,
  saveConfig,
  configExists,
  getConfigDir,
  resetConfigCache,
} from "../../config/loader.js";
import { NovaClawConfigSchema, NovaClawConfig } from "../../config/schema.js";
import { getEnabledSkills } from "../../config/loader.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a dot-notation key path into a value from an object. */
function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Set a value at a dot-notation key path in an object (mutates). */
function setNestedValue(
  obj: Record<string, unknown>,
  keyPath: string,
  value: unknown
): void {
  const parts = keyPath.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      current[part] === null ||
      current[part] === undefined ||
      typeof current[part] !== "object"
    ) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/** Parse a CLI string value into the most appropriate JS type. */
function parseValue(raw: string): unknown {
  // JSON array or object
  if (
    (raw.startsWith("[") && raw.endsWith("]")) ||
    (raw.startsWith("{") && raw.endsWith("}"))
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through
    }
  }
  // Quoted string
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  // Boolean
  if (raw === "true") return true;
  if (raw === "false") return false;
  // Null
  if (raw === "null") return null;
  // Number
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== "") return num;
  // Fallback: raw string
  return raw;
}

/** Mask sensitive credential strings with asterisks. */
function maskSensitive(value: unknown): string {
  if (typeof value === "string" && value.length > 4) {
    return "***";
  }
  if (value === null || value === undefined) return "—";
  return String(value);
}

/** Format a value for display, masking nothing (used in non-credential context). */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return chalk.gray("—");
  if (Array.isArray(value)) {
    if (value.length === 0) return chalk.gray("[]");
    return chalk.cyan(value.join(", "));
  }
  if (typeof value === "boolean") return value ? chalk.green("true") : chalk.red("false");
  if (typeof value === "object") return chalk.gray(JSON.stringify(value));
  return chalk.white(String(value));
}

// ---------------------------------------------------------------------------
// config show
// ---------------------------------------------------------------------------

function displayConfig(jsonMode: boolean): void {
  if (!configExists()) {
    console.error(
      chalk.red("No configuration found. Run 'novaclaw setup' first.")
    );
    process.exit(1);
  }

  const config = loadConfig();

  if (jsonMode) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const BORDER = "═".repeat(59);
  const enabledSkillsCount = getEnabledSkills(config).length;
  const configDir = getConfigDir();
  const configFilePath = path.join(configDir, "novaclaw.json").replace(os.homedir(), "~");

  console.log("\n" + chalk.cyan(BORDER));
  console.log(chalk.cyan("  NovaClaw Configuration"));
  console.log(chalk.cyan(BORDER) + "\n");

  // Agent section
  console.log(chalk.bold.yellow("Agent"));
  const agent = config.agent ?? {};
  console.log(`  ${chalk.gray("name".padEnd(20))} ${formatValue(agent.name)}`);
  console.log(`  ${chalk.gray("language".padEnd(20))} ${formatValue(agent.language)}`);
  console.log(`  ${chalk.gray("personality".padEnd(20))} ${formatValue(agent.personality)}`);
  if (agent.customSystemPrompt) {
    const preview = String(agent.customSystemPrompt).slice(0, 50) + "...";
    console.log(`  ${chalk.gray("customSystemPrompt".padEnd(20))} ${chalk.white(preview)}`);
  }

  // Provider section
  console.log("\n" + chalk.bold.yellow("Provider"));
  const provider = config.provider ?? {};
  console.log(`  ${chalk.gray("type".padEnd(20))} ${formatValue(provider.type)}`);
  console.log(`  ${chalk.gray("authMethod".padEnd(20))} ${formatValue(provider.authMethod)}`);
  console.log(`  ${chalk.gray("model".padEnd(20))} ${formatValue(provider.model)}`);
  console.log(`  ${chalk.gray("fallbackModel".padEnd(20))} ${formatValue(provider.fallbackModel)}`);

  // Channels section
  console.log("\n" + chalk.bold.yellow("Channels"));
  const telegram = config.channels?.telegram ?? {};
  console.log(`  ${chalk.gray("telegram.enabled".padEnd(20))} ${formatValue(telegram.enabled)}`);
  console.log(`  ${chalk.gray("telegram.ownerId".padEnd(20))} ${formatValue(telegram.ownerId)}`);
  console.log(
    `  ${chalk.gray("telegram.allowedUsers".padEnd(20))} ${chalk.white(
      Array.isArray(telegram.allowedUsers) ? `${telegram.allowedUsers.length} user(s)` : "—"
    )}`
  );

  // Skills section
  console.log("\n" + chalk.bold.yellow("Skills"));
  const skills = config.skills ?? {};
  console.log(`  ${chalk.gray("preset".padEnd(20))} ${formatValue(skills.preset)}`);
  console.log(
    `  ${chalk.gray("enabled".padEnd(20))} ${chalk.white(String(enabledSkillsCount) + " skills")}`
  );
  if (Array.isArray(skills.enabled) && skills.enabled.length > 0) {
    console.log(`  ${chalk.gray("  +overrides".padEnd(20))} ${chalk.green("+" + skills.enabled.join(", +"))}`);
  }
  if (Array.isArray(skills.disabled) && skills.disabled.length > 0) {
    console.log(`  ${chalk.gray("  -overrides".padEnd(20))} ${chalk.red("-" + skills.disabled.join(", -"))}`);
  }

  // Security section
  console.log("\n" + chalk.bold.yellow("Security"));
  const security = config.security ?? {};
  const rateLimit = security.rateLimit ?? {};
  console.log(
    `  ${chalk.gray("rateLimit".padEnd(20))} ${chalk.white(
      rateLimit.messagesPerMinute !== undefined
        ? `${rateLimit.messagesPerMinute} msg/min`
        : "—"
    )}`
  );
  const shellMode = security.shell?.mode;
  console.log(`  ${chalk.gray("shell.mode".padEnd(20))} ${formatValue(shellMode)}`);
  const httpPrivate = security.http?.allowPrivateIPs;
  console.log(`  ${chalk.gray("http.allowPrivateIPs".padEnd(20))} ${formatValue(httpPrivate)}`);

  // Gateway section
  console.log("\n" + chalk.bold.yellow("Gateway"));
  const gateway = config.gateway ?? {};
  console.log(`  ${chalk.gray("autoStart".padEnd(20))} ${formatValue(gateway.autoStart)}`);
  console.log(`  ${chalk.gray("logLevel".padEnd(20))} ${formatValue(gateway.logLevel)}`);

  // Service section
  console.log("\n" + chalk.bold.yellow("Service"));
  const service = config.service ?? {};
  console.log(`  ${chalk.gray("installed".padEnd(20))} ${formatValue(service.installed)}`);
  console.log(`  ${chalk.gray("autoStart".padEnd(20))} ${formatValue(service.autoStart)}`);

  // Footer
  console.log("\n" + chalk.gray(`Config: ${configFilePath}`));
  console.log();
}

// ---------------------------------------------------------------------------
// config edit
// ---------------------------------------------------------------------------

function editConfig(): void {
  if (!configExists()) {
    console.error(
      chalk.red("No configuration found. Run 'novaclaw setup' first.")
    );
    process.exit(1);
  }

  const configFile = path.join(getConfigDir(), "novaclaw.json");

  // Determine editor
  let editor = process.env.EDITOR || process.env.VISUAL || "";

  if (!editor) {
    if (process.platform === "win32") {
      editor = "notepad";
    } else {
      // Try nano, then vim
      try {
        execSync("which nano", { stdio: "ignore" });
        editor = "nano";
      } catch {
        editor = "vim";
      }
    }
  }

  console.log(chalk.cyan(`Opening ${configFile} in ${editor}…`));

  try {
    execSync(`"${editor}" "${configFile}"`, { stdio: "inherit" });
    console.log(chalk.green("Config file closed. Changes saved."));
    // Validate the file was not broken
    try {
      const raw = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      NovaClawConfigSchema.parse(raw);
      console.log(chalk.green("Configuration is valid."));
    } catch (err) {
      console.warn(
        chalk.yellow(
          `Warning: Configuration may be invalid after editing: ${err}`
        )
      );
    }
  } catch (err) {
    console.error(chalk.red(`Failed to open editor: ${err}`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// config set
// ---------------------------------------------------------------------------

function configSet(key: string, value: string): void {
  if (!configExists()) {
    console.error(
      chalk.red("No configuration found. Run 'novaclaw setup' first.")
    );
    process.exit(1);
  }

  const config = loadConfig();
  const configObj = config as unknown as Record<string, unknown>;
  const parsed = parseValue(value);

  setNestedValue(configObj, key, parsed);

  // Validate against schema
  let validated: NovaClawConfig;
  try {
    validated = NovaClawConfigSchema.parse(configObj);
  } catch (err) {
    console.error(chalk.red(`Invalid value for '${key}': ${err}`));
    process.exit(1);
  }

  saveConfig(validated);
  console.log(
    `${chalk.green("Set")} ${chalk.cyan(key)} ${chalk.gray("=")} ${chalk.white(JSON.stringify(parsed))}`
  );
}

// ---------------------------------------------------------------------------
// config get
// ---------------------------------------------------------------------------

function configGet(key: string): void {
  if (!configExists()) {
    console.error(
      chalk.red("No configuration found. Run 'novaclaw setup' first.")
    );
    process.exit(1);
  }

  const config = loadConfig();
  const value = getNestedValue(config as unknown as Record<string, unknown>, key);

  if (value === undefined) {
    console.error(chalk.red(`Key '${key}' not found in configuration.`));
    process.exit(1);
  }

  // Print raw value for script-friendliness
  if (typeof value === "object") {
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(String(value));
  }
}

// ---------------------------------------------------------------------------
// config reset
// ---------------------------------------------------------------------------

async function configReset(): Promise<void> {
  if (!configExists()) {
    console.error(
      chalk.red("No configuration found. Run 'novaclaw setup' first.")
    );
    process.exit(1);
  }

  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message: chalk.yellow(
        "This will reset your configuration to defaults (credentials are preserved). Continue?"
      ),
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.gray("Reset cancelled."));
    return;
  }

  const configDir = getConfigDir();
  const configFile = path.join(configDir, "novaclaw.json");
  const backupFile = path.join(configDir, "novaclaw.json.backup");

  // Backup current config
  try {
    fs.copyFileSync(configFile, backupFile);
    console.log(chalk.green(`Backup created: ${backupFile}`));
  } catch (err) {
    console.warn(chalk.yellow(`Could not create backup: ${err}`));
  }

  // Load existing config to preserve channels (owner ID) since channels is required
  const existingConfig = loadConfig();

  // Build a fresh default config, preserving channels (required field)
  const defaultConfigRaw = {
    version: "2.0" as const,
    channels: existingConfig.channels,
    // All other fields will get schema defaults
  };

  let freshConfig: NovaClawConfig;
  try {
    freshConfig = NovaClawConfigSchema.parse(defaultConfigRaw);
  } catch (err) {
    console.error(chalk.red(`Failed to build default config: ${err}`));
    process.exit(1);
  }

  resetConfigCache();
  saveConfig(freshConfig);

  console.log(chalk.green("Configuration reset to defaults."));
  console.log(chalk.gray("Credentials (telegram, anthropic) are unchanged."));
  console.log(chalk.gray(`Backup saved to: ${backupFile.replace(os.homedir(), "~")}`));
}

// ---------------------------------------------------------------------------
// Export command
// ---------------------------------------------------------------------------

export const configCommand = new Command("config")
  .description("Manage NovaClaw configuration");

configCommand
  .command("show")
  .description("Display current configuration")
  .option("--json", "Output as raw JSON")
  .action((options: { json?: boolean }) => {
    displayConfig(options.json ?? false);
  });

configCommand
  .command("edit")
  .description("Open configuration file in default editor")
  .action(() => {
    editConfig();
  });

configCommand
  .command("set <key> <value>")
  .description("Set a configuration value using dot notation (e.g. provider.model claude-opus-4-6)")
  .action((key: string, value: string) => {
    configSet(key, value);
  });

configCommand
  .command("get <key>")
  .description("Get a configuration value using dot notation (e.g. provider.model)")
  .action((key: string) => {
    configGet(key);
  });

configCommand
  .command("reset")
  .description("Reset configuration to defaults (keeps credentials, creates backup)")
  .action(async () => {
    await configReset();
  });
