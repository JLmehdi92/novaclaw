// src/cli/commands/status.ts
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import { showLogo } from "../logo.js";

export const statusCommand = new Command("status")
  .description("Show NovaClaw status")
  .action(async () => {
    showLogo();

    const envExists = fs.existsSync(".env");
    const dbExists = fs.existsSync("./data/novaclaw.db");

    console.log(chalk.white.bold("NovaClaw Status\n"));

    console.log(
      `Configuration: ${envExists ? chalk.green("✓ Found") : chalk.red("✗ Not found - run novaclaw setup")}`
    );
    console.log(
      `Database: ${dbExists ? chalk.green("✓ Found") : chalk.yellow("○ Will be created on first start")}`
    );

    if (envExists) {
      try {
        const { loadConfig } = await import("../../config.js");
        const config = loadConfig();
        console.log(`\nModel: ${chalk.cyan(config.claude.model)}`);
        console.log(`Language: ${chalk.cyan(config.language)}`);
        console.log(`Allowed users: ${chalk.cyan(config.telegram.allowedIds.length)}`);
      } catch (e) {
        console.log(chalk.red("\nError loading config - check your .env file"));
      }
    }

    console.log("\n" + chalk.gray("Run 'novaclaw start' to launch the agent"));
  });
