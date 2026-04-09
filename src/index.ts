// src/index.ts
import { loadConfig } from "./config.js";
import { initDatabase, closeDatabase } from "./storage/db.js";
import { initializeSkills } from "./skills/init.js";
import { ClaudeClient } from "./claude/client.js";
import { startBot, stopBot } from "./gateway/bot.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  try {
    logger.info("Démarrage NovaClaw...");

    const config = loadConfig();
    logger.info(`Configuration chargée (model: ${config.claude.model})`);

    await initDatabase();
    logger.info("Base de données initialisée");

    await ClaudeClient.initialize({ model: config.claude.model });
    logger.info("Client Claude initialisé");

    initializeSkills();

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`Signal ${signal} reçu, arrêt en cours...`);
      try {
        stopBot();
        closeDatabase();
        logger.info("NovaClaw arrêté proprement");
        process.exit(0);
      } catch (error) {
        logger.error(`Erreur arrêt: ${error}`);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("uncaughtException", (error) => {
      logger.error(`Exception non gérée: ${error}`);
      shutdown("uncaughtException");
    });
    process.on("unhandledRejection", (reason) => {
      logger.error(`Promesse rejetée: ${reason}`);
    });

    await startBot();
  } catch (error) {
    logger.error(`Erreur démarrage NovaClaw: ${error}`);
    process.exit(1);
  }
}

main();
