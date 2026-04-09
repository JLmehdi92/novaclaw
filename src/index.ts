// src/index.ts
import { loadConfig } from "./config.js";
import { initDatabase } from "./storage/db.js";
import { initializeSkills } from "./skills/init.js";
import { ClaudeClient } from "./claude/client.js";
import { startBot } from "./gateway/bot.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  try {
    logger.info("Starting NovaClaw...");

    const config = loadConfig();
    logger.info(`Configuration loaded (model: ${config.claude.model})`);

    await initDatabase();
    logger.info("Database initialized");

    await ClaudeClient.initialize({ model: config.claude.model });
    logger.info("Claude client initialized");

    initializeSkills();

    await startBot();
  } catch (error) {
    logger.error(`Failed to start NovaClaw: ${error}`);
    process.exit(1);
  }
}

main();
