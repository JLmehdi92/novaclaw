// src/cli/commands/setup.ts
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { showLogo } from "../logo.js";
import { NovaClawConfig, Credentials } from "../../config/schema.js";
import { saveConfig, saveCredentials, ensureConfigDir, configExists } from "../../config/loader.js";
import { detectLegacyEnv, performMigration } from "../../config/migrate.js";
import { PERSONALITY_PROMPTS, SKILL_PRESETS, SECURITY_PRESETS, ALL_SKILLS, SKILL_CATEGORIES } from "../../config/defaults.js";
import { CLAUDE_MODELS } from "../../claude/models.js";

// ---------------------------------------------------------------------------
// Telegram token validation
// ---------------------------------------------------------------------------
async function validateTelegramToken(
  token: string
): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await response.json()) as {
      ok: boolean;
      result?: { username: string };
      description?: string;
    };
    if (data.ok) return { valid: true, username: data.result?.username };
    return { valid: false, error: data.description };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------
async function chooseMode(): Promise<"quick" | "complete"> {
  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: chalk.bold("Quel mode de configuration ?"),
      choices: [
        {
          name: chalk.green("⚡ Quick Setup") + chalk.gray("  (~2 min) – Telegram + Auth + Langue, reste par défaut"),
          value: "quick",
        },
        {
          name: chalk.blue("🔧 Complete Setup") + chalk.gray(" (~5 min) – Toutes les sections (skills, sécurité, service…)"),
          value: "complete",
        },
      ],
    },
  ]);
  return mode as "quick" | "complete";
}

// ---------------------------------------------------------------------------
// Section: Telegram
// ---------------------------------------------------------------------------
async function setupTelegram(): Promise<{
  botToken: string;
  ownerId: number;
}> {
  console.log("\n" + chalk.cyan.bold("━━ Telegram ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  // Bot token with validation
  let botToken = "";
  let botUsername = "";
  while (true) {
    const { token } = await inquirer.prompt([
      {
        type: "input",
        name: "token",
        message: "Bot Token (depuis @BotFather) :",
        validate: (v) => (v.length > 20 ? true : "Token trop court"),
      },
    ]);

    const spinner = ora("Vérification du token…").start();
    const result = await validateTelegramToken(token);
    if (result.valid) {
      spinner.succeed(chalk.green(`Token valide – bot : @${result.username}`));
      botToken = token;
      botUsername = result.username ?? "";
      break;
    } else {
      spinner.fail(chalk.red(`Token invalide : ${result.error}`));
      const { retry } = await inquirer.prompt([
        { type: "confirm", name: "retry", message: "Réessayer ?", default: true },
      ]);
      if (!retry) {
        console.log(chalk.yellow("Token non validé – tu pourras le corriger manuellement."));
        botToken = token;
        break;
      }
    }
  }

  // Owner ID
  const { ownerIdStr } = await inquirer.prompt([
    {
      type: "input",
      name: "ownerIdStr",
      message: "Ton Telegram User ID (envoie /start à @userinfobot) :",
      validate: (v) => (/^\d+$/.test(v.trim()) ? true : "Doit être un nombre entier"),
    },
  ]);

  return { botToken, ownerId: Number(ownerIdStr.trim()) };
}

// ---------------------------------------------------------------------------
// Section: Additional users
// ---------------------------------------------------------------------------
async function setupAdditionalUsers(ownerId: number): Promise<number[]> {
  const { addUsers } = await inquirer.prompt([
    {
      type: "confirm",
      name: "addUsers",
      message: "Ajouter d'autres utilisateurs autorisés ?",
      default: false,
    },
  ]);

  if (!addUsers) return [];

  const { idsStr } = await inquirer.prompt([
    {
      type: "input",
      name: "idsStr",
      message: "IDs supplémentaires (séparés par virgule) :",
      validate: (v) => {
        if (!v.trim()) return true;
        const parts = v.split(",").map((s: string) => s.trim());
        return parts.every((p: string) => /^\d+$/.test(p)) || "Format invalide (ex: 123456,789012)";
      },
    },
  ]);

  return idsStr
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n: number) => n !== ownerId);
}

// ---------------------------------------------------------------------------
// Section: Auth (Claude / Anthropic)
// ---------------------------------------------------------------------------
async function setupAuth(): Promise<{
  authMethod: "oauth" | "apikey";
  apiKey: string | null;
}> {
  console.log("\n" + chalk.cyan.bold("━━ Authentification Claude ━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const { authMethod } = await inquirer.prompt([
    {
      type: "list",
      name: "authMethod",
      message: "Méthode d'authentification Anthropic :",
      choices: [
        { name: "API Key (recommandé)", value: "apikey" },
        { name: "OAuth (non disponible dans cette version)", value: "oauth" },
      ],
      default: "apikey",
    },
  ]);

  if (authMethod === "oauth") {
    // OAuth placeholder – falls back to API key
    console.log(chalk.yellow("OAuth non disponible dans cette version. Utilise l'API Key."));
  }

  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Clé API Anthropic (sk-ant-…) :",
      mask: "*",
      validate: (v) =>
        v.trim().length > 10 || authMethod === "oauth" ? true : "Clé API requise",
    },
  ]);

  return {
    authMethod: "apikey",
    apiKey: apiKey.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Section: Language
// ---------------------------------------------------------------------------
async function setupLanguage(): Promise<"fr" | "en"> {
  const { language } = await inquirer.prompt([
    {
      type: "list",
      name: "language",
      message: "Langue par défaut :",
      choices: [
        { name: "Français", value: "fr" },
        { name: "English", value: "en" },
      ],
      default: "fr",
    },
  ]);
  return language as "fr" | "en";
}

// ---------------------------------------------------------------------------
// Section: Model selection
// ---------------------------------------------------------------------------
async function setupModels(): Promise<{ model: string; fallbackModel: string }> {
  console.log("\n" + chalk.cyan.bold("━━ Modèles Claude ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const modelChoices = Object.entries(CLAUDE_MODELS).map(([key, m]) => ({
    name: `${m.name} – ${m.description}${m.recommended ? chalk.green(" ★ recommandé") : ""}`,
    value: key,
  }));

  const { primaryKey } = await inquirer.prompt([
    {
      type: "list",
      name: "primaryKey",
      message: "Modèle principal :",
      choices: modelChoices,
      default: "sonnet-4.6",
    },
  ]);

  const fallbackChoices = Object.entries(CLAUDE_MODELS)
    .filter(([k]) => k !== primaryKey)
    .map(([key, m]) => ({ name: `${m.name} – ${m.description}`, value: key }));
  fallbackChoices.unshift({ name: "Aucun fallback", value: "none" });

  const { fallbackKey } = await inquirer.prompt([
    {
      type: "list",
      name: "fallbackKey",
      message: "Modèle de repli (si le principal échoue) :",
      choices: fallbackChoices,
      default: "haiku-4.5",
    },
  ]);

  return {
    model: CLAUDE_MODELS[primaryKey]?.id ?? primaryKey,
    fallbackModel: fallbackKey === "none" ? "" : (CLAUDE_MODELS[fallbackKey]?.id ?? fallbackKey),
  };
}

// ---------------------------------------------------------------------------
// Section: Skills
// ---------------------------------------------------------------------------
async function setupSkills(): Promise<{
  preset: "minimal" | "standard" | "developer" | "power" | "full";
  enabled: string[];
  disabled: string[];
}> {
  console.log("\n" + chalk.cyan.bold("━━ Skills ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const presetChoices = Object.entries(SKILL_PRESETS).map(([key, skills]) => ({
    name: `${key.padEnd(12)} (${skills.length} skills)`,
    value: key,
  }));

  const { preset } = await inquirer.prompt([
    {
      type: "list",
      name: "preset",
      message: "Preset de skills :",
      choices: presetChoices,
      default: "standard",
    },
  ]);

  const { customize } = await inquirer.prompt([
    {
      type: "confirm",
      name: "customize",
      message: "Personnaliser les skills (activer/désactiver individuellement) ?",
      default: false,
    },
  ]);

  if (!customize) {
    return { preset, enabled: [], disabled: [] };
  }

  // Build per-category checkbox questions
  const presetSkills = new Set(SKILL_PRESETS[preset] ?? []);
  const enabled: string[] = [];
  const disabled: string[] = [];

  for (const category of SKILL_CATEGORIES) {
    const categorySkills = ALL_SKILLS.filter((s) => s.category === category.id);
    if (categorySkills.length === 0) continue;

    const { selected } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selected",
        message: `${category.icon} ${category.name} :`,
        choices: categorySkills.map((s) => ({
          name: `${s.name.padEnd(20)} ${chalk.gray(s.description)}`,
          value: s.id,
          checked: presetSkills.has(s.id),
        })),
      },
    ]);

    for (const skill of categorySkills) {
      const wasInPreset = presetSkills.has(skill.id);
      const isSelected = (selected as string[]).includes(skill.id);
      if (isSelected && !wasInPreset) enabled.push(skill.id);
      if (!isSelected && wasInPreset) disabled.push(skill.id);
    }
  }

  return { preset, enabled, disabled };
}

// ---------------------------------------------------------------------------
// Section: Personality
// ---------------------------------------------------------------------------
async function setupPersonality(): Promise<{
  personality: "professional" | "assistant" | "casual" | "minimal" | "custom";
  customSystemPrompt: string | null;
}> {
  console.log("\n" + chalk.cyan.bold("━━ Personnalité ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const personalityChoices = Object.entries(PERSONALITY_PROMPTS)
    .filter(([key]) => key !== "custom")
    .map(([key, prompt]) => ({
      name: `${key.padEnd(14)} – ${prompt.slice(0, 60)}…`,
      value: key,
    }));
  personalityChoices.push({ name: "custom         – Rédiger mon propre prompt système", value: "custom" });

  const { personality } = await inquirer.prompt([
    {
      type: "list",
      name: "personality",
      message: "Personnalité de l'agent :",
      choices: personalityChoices,
      default: "assistant",
    },
  ]);

  let customSystemPrompt: string | null = null;
  if (personality === "custom") {
    const { customPrompt } = await inquirer.prompt([
      {
        type: "editor",
        name: "customPrompt",
        message: "Rédige ton prompt système (s'ouvrira dans ton éditeur) :",
      },
    ]);
    customSystemPrompt = customPrompt.trim() || null;
  }

  return {
    personality: personality as "professional" | "assistant" | "casual" | "minimal" | "custom",
    customSystemPrompt,
  };
}

// ---------------------------------------------------------------------------
// Section: Security
// ---------------------------------------------------------------------------
async function setupSecurity(): Promise<NovaClawConfig["security"]> {
  console.log("\n" + chalk.cyan.bold("━━ Sécurité ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const presetChoices = Object.keys(SECURITY_PRESETS).map((key) => ({
    name: `${key.padEnd(12)} – ${
      key === "strict"
        ? "Très restrictif (usage personnel prudent)"
        : key === "balanced"
        ? "Equilibré (recommandé)"
        : "Permissif (développement local)"
    }`,
    value: key,
  }));

  const { preset } = await inquirer.prompt([
    {
      type: "list",
      name: "preset",
      message: "Preset de sécurité :",
      choices: presetChoices,
      default: "balanced",
    },
  ]);

  const chosen = SECURITY_PRESETS[preset];

  const { customize } = await inquirer.prompt([
    {
      type: "confirm",
      name: "customize",
      message: "Personnaliser les paramètres de sécurité ?",
      default: false,
    },
  ]);

  if (!customize) {
    return {
      rateLimit: chosen.rateLimit,
      shell: { ...chosen.shell, blockedCommands: [] },
      http: { ...chosen.http, blockedDomains: [] },
      code: { ...chosen.code, maxExecutionTime: 30000 },
    };
  }

  const { messagesPerMinute } = await inquirer.prompt([
    {
      type: "number",
      name: "messagesPerMinute",
      message: "Messages max par minute :",
      default: chosen.rateLimit.messagesPerMinute,
    },
  ]);

  const { allowPrivateIPs } = await inquirer.prompt([
    {
      type: "confirm",
      name: "allowPrivateIPs",
      message: "Autoriser les IPs privées (HTTP) ?",
      default: chosen.http.allowPrivateIPs,
    },
  ]);

  return {
    rateLimit: { messagesPerMinute: messagesPerMinute ?? chosen.rateLimit.messagesPerMinute, cooldownSeconds: chosen.rateLimit.cooldownSeconds },
    shell: { ...chosen.shell, blockedCommands: [] },
    http: { allowPrivateIPs: allowPrivateIPs ?? chosen.http.allowPrivateIPs, blockedDomains: [] },
    code: { ...chosen.code, maxExecutionTime: 30000 },
  };
}

// ---------------------------------------------------------------------------
// Section: Service (Windows)
// ---------------------------------------------------------------------------
async function setupService(): Promise<{ installService: boolean }> {
  console.log("\n" + chalk.cyan.bold("━━ Service Windows ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const { installService } = await inquirer.prompt([
    {
      type: "confirm",
      name: "installService",
      message: "Installer NovaClaw comme service Windows (démarre automatiquement) ?",
      default: false,
    },
  ]);

  return { installService };
}

// ---------------------------------------------------------------------------
// Summary display
// ---------------------------------------------------------------------------
function showSummary(config: NovaClawConfig, credentials: Credentials): void {
  console.log("\n" + chalk.cyan.bold("━━ Résumé de la configuration ━━━━━━━━━━━━━━━━━━━━━━━"));

  const rows: Array<[string, string]> = [
    ["Bot Telegram", `@${credentials.telegram.botToken.split(":")[0]}`],
    ["Owner ID", String(config.channels.telegram.ownerId)],
    ["Utilisateurs autorisés", String(config.channels.telegram.allowedUsers.length)],
    ["Auth Anthropic", config.provider.authMethod],
    ["Modèle principal", config.provider.model],
    ["Fallback model", config.provider.fallbackModel ?? "—"],
    ["Langue", config.agent.language],
    ["Personnalité", config.agent.personality],
    ["Skills preset", config.skills.preset],
    ["Skills activés (+)", String(config.skills.enabled.length)],
    ["Skills désactivés (−)", String(config.skills.disabled.length)],
    ["Sécurité rate-limit", `${config.security?.rateLimit?.messagesPerMinute} msg/min`],
    ["Service installé", config.service?.installed ? "oui" : "non"],
  ];

  for (const [label, value] of rows) {
    console.log(`  ${chalk.gray(label.padEnd(28))} ${chalk.white(value)}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Save + optional service install
// ---------------------------------------------------------------------------
async function saveConfiguration(
  config: NovaClawConfig,
  credentials: Credentials,
  installService: boolean
): Promise<void> {
  const spinner = ora("Sauvegarde de la configuration…").start();
  try {
    ensureConfigDir();
    saveConfig(config);
    saveCredentials(credentials);
    spinner.succeed("Configuration sauvegardée");
  } catch (err) {
    spinner.fail("Erreur de sauvegarde");
    throw err;
  }

  if (installService) {
    const svcSpinner = ora("Installation du service Windows…").start();
    try {
      // Dynamically import node-windows to avoid hard-dep at module level
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeWindows = await import("node-windows" as any);
      const { Service } = nodeWindows as any;
      const svc = new Service({
        name: "NovaClaw",
        description: "NovaClaw Personal AI Agent",
        script: process.argv[1],
        nodeOptions: ["--experimental-vm-modules"],
      });
      await new Promise<void>((resolve, reject) => {
        svc.on("install", () => { svc.start(); resolve(); });
        svc.on("error", reject);
        svc.install();
      });
      svcSpinner.succeed("Service Windows installé et démarré");
    } catch (err) {
      svcSpinner.warn(`Service non installé : ${err}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Quick setup flow
// ---------------------------------------------------------------------------
async function quickSetup(): Promise<void> {
  console.log(chalk.yellow("\nMode Quick Setup (~2 min)\n"));

  const { botToken, ownerId } = await setupTelegram();
  const additionalUsers = await setupAdditionalUsers(ownerId);
  const { authMethod, apiKey } = await setupAuth();
  const language = await setupLanguage();

  const config: NovaClawConfig = {
    version: "2.0",
    agent: {
      name: "NovaClaw",
      language,
      personality: "assistant",
      customSystemPrompt: null,
    },
    provider: {
      type: "anthropic",
      authMethod,
      model: "claude-sonnet-4-6",
      fallbackModel: "claude-haiku-4-5",
    },
    channels: {
      telegram: {
        enabled: true,
        ownerId,
        allowedUsers: [ownerId, ...additionalUsers],
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
    gateway: { autoStart: true, logLevel: "info" },
    service: { installed: false, name: "NovaClaw", autoStart: true },
  };

  const credentials: Credentials = {
    telegram: { botToken },
    anthropic: {
      authMethod,
      apiKey,
      oauthToken: null,
      oauthEmail: null,
    },
  };

  showSummary(config, credentials);

  const { confirm } = await inquirer.prompt([
    { type: "confirm", name: "confirm", message: "Sauvegarder cette configuration ?", default: true },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("Configuration annulée."));
    return;
  }

  await saveConfiguration(config, credentials, false);
}

// ---------------------------------------------------------------------------
// Complete setup flow
// ---------------------------------------------------------------------------
async function completeSetup(): Promise<void> {
  console.log(chalk.blue("\nMode Complete Setup (~5 min)\n"));

  // 1. Telegram
  const { botToken, ownerId } = await setupTelegram();
  const additionalUsers = await setupAdditionalUsers(ownerId);

  // 2. Auth
  const { authMethod, apiKey } = await setupAuth();

  // 3. Language
  const language = await setupLanguage();

  // 4. Models
  const { model, fallbackModel } = await setupModels();

  // 5. Skills
  const { preset: skillsPreset, enabled: skillsEnabled, disabled: skillsDisabled } = await setupSkills();

  // 6. Personality
  const { personality, customSystemPrompt } = await setupPersonality();

  // 7. Security
  const security = await setupSecurity();

  // 8. Service
  const { installService } = await setupService();

  const config: NovaClawConfig = {
    version: "2.0",
    agent: {
      name: "NovaClaw",
      language,
      personality,
      customSystemPrompt,
    },
    provider: {
      type: "anthropic",
      authMethod,
      model,
      fallbackModel: fallbackModel || null,
    },
    channels: {
      telegram: {
        enabled: true,
        ownerId,
        allowedUsers: [ownerId, ...additionalUsers],
      },
    },
    skills: {
      preset: skillsPreset,
      enabled: skillsEnabled,
      disabled: skillsDisabled,
      config: {},
    },
    security,
    gateway: { autoStart: true, logLevel: "info" },
    service: { installed: installService, name: "NovaClaw", autoStart: true },
  };

  const credentials: Credentials = {
    telegram: { botToken },
    anthropic: {
      authMethod,
      apiKey,
      oauthToken: null,
      oauthEmail: null,
    },
  };

  showSummary(config, credentials);

  const { confirm } = await inquirer.prompt([
    { type: "confirm", name: "confirm", message: "Sauvegarder cette configuration ?", default: true },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("Configuration annulée."));
    return;
  }

  await saveConfiguration(config, credentials, installService);
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------
export const setupCommand = new Command("setup")
  .description("Interactive setup wizard for NovaClaw")
  .option("--quick", "Quick setup with defaults")
  .option("--reset", "Reset existing configuration")
  .action(async (options: { quick?: boolean; reset?: boolean }) => {
    // 1. Show logo
    showLogo();
    console.log(chalk.yellow.bold("Bienvenue dans le wizard de configuration NovaClaw v2.0\n"));

    try {
      // 2. Check existing config
      if (configExists() && !options.reset) {
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: chalk.yellow("Une configuration existe déjà. Que veux-tu faire ?"),
            choices: [
              { name: "Modifier (reconfigurer)", value: "edit" },
              { name: "Réinitialiser (tout effacer)", value: "reset" },
              { name: "Annuler", value: "cancel" },
            ],
          },
        ]);
        if (action === "cancel") {
          console.log(chalk.gray("Setup annulé."));
          return;
        }
        // 'edit' and 'reset' both continue through the wizard
      }

      // 3. Check legacy .env
      const legacyEnvPath = detectLegacyEnv();
      if (legacyEnvPath) {
        console.log(chalk.yellow(`\nFichier .env legacy détecté : ${legacyEnvPath}`));
        const { migrate } = await inquirer.prompt([
          {
            type: "confirm",
            name: "migrate",
            message: "Migrer automatiquement ce fichier .env vers la nouvelle config ?",
            default: true,
          },
        ]);
        if (migrate) {
          const spinner = ora("Migration en cours…").start();
          try {
            performMigration(legacyEnvPath);
            spinner.succeed("Migration réussie ! L'ancien .env a été sauvegardé en .env.backup");
            console.log(chalk.green("\nTu peux quand même relancer setup pour ajuster la config.\n"));
            const { continueSetup } = await inquirer.prompt([
              {
                type: "confirm",
                name: "continueSetup",
                message: "Continuer le wizard de configuration ?",
                default: false,
              },
            ]);
            if (!continueSetup) return;
          } catch (err) {
            spinner.fail(`Erreur de migration : ${err}`);
          }
        }
      }

      // 4. Choose mode (unless --quick flag)
      let mode: "quick" | "complete";
      if (options.quick) {
        mode = "quick";
        console.log(chalk.green("Mode --quick activé.\n"));
      } else {
        mode = await chooseMode();
      }

      // 5. Run the appropriate flow
      if (mode === "quick") {
        await quickSetup();
      } else {
        await completeSetup();
      }

      // Done!
      console.log("\n" + chalk.green("═".repeat(54)));
      console.log(chalk.green.bold("\n  NovaClaw configuré avec succès !\n"));
      console.log(chalk.white("  Prochaines étapes :"));
      console.log(chalk.gray("    1. Démarre l'agent :  ") + chalk.cyan("novaclaw start"));
      console.log(chalk.gray("    2. Envoie /start à ton bot Telegram"));
      console.log(chalk.green("\n" + "═".repeat(54) + "\n"));
    } catch (error) {
      console.error(chalk.red(`\nErreur fatale du wizard : ${error}`));
      process.exit(1);
    }
  });
