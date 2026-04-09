// src/cli/commands/start.ts
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { showLogo, showSuccess, showError } from "../logo.js";
import { loadConfig, configExists, getConfigDir } from "../../config/loader.js";
import { initDatabase } from "../../storage/db.js";
import { initializeSkills } from "../../skills/init.js";
import { ClaudeClient } from "../../claude/client.js";
import { startBot } from "../../gateway/bot.js";
import { SkillsRegistry } from "../../skills/registry.js";

export const startCommand = new Command("start")
  .description("Start NovaClaw agent")
  .option("-d, --daemon", "Run in background (not implemented yet)")
  .option("--dev", "Development mode")
  .action(async (options) => {
    showLogo();

    try {
      // Check if config exists
      if (!configExists()) {
        showError(`Configuration non trouvée. Exécute 'novaclaw setup' d'abord.`);
        console.log(chalk.gray(`  Chemin: ${getConfigDir()}`));
        process.exit(1);
      }

      let spinner = ora("Loading configuration...").start();
      const config = loadConfig();
      spinner.succeed(`Configuration loaded (${config.agent.language})`);

      spinner = ora("Initializing database...").start();
      await initDatabase();
      spinner.succeed("Database ready");

      spinner = ora("Initializing Claude...").start();
      await ClaudeClient.initialize({ model: config.provider.model });
      spinner.succeed(`Claude ready (${config.provider.model})`);

      spinner = ora("Loading skills...").start();
      initializeSkills();
      spinner.succeed(`${SkillsRegistry.count()} skills loaded`);

      spinner = ora("Connecting to Telegram...").start();

      console.log("\n" + chalk.green("═".repeat(50)));
      console.log(chalk.green.bold("\n  NovaClaw is running!\n"));
      console.log(chalk.gray("  Press Ctrl+C to stop\n"));
      console.log(chalk.green("═".repeat(50) + "\n"));

      await startBot();
    } catch (error) {
      showError(`Failed to start: ${error}`);
      process.exit(1);
    }
  });
