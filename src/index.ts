// src/index.ts
import { loadConfig, loadCredentials, configExists, getConfigDir } from "./config/loader.js";
import { initDatabase, closeDatabase } from "./storage/db.js";
import { initializeSkills } from "./skills/init.js";
import { ClaudeClient } from "./claude/client.js";
import { startBot, stopBot } from "./gateway/bot.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  try {
    logger.info("Démarrage NovaClaw v2.0...");

    // Check if config exists
    if (!configExists()) {
      logger.error(`Configuration non trouvée. Exécutez 'novaclaw setup' d'abord.`);
      logger.info(`Chemin config: ${getConfigDir()}`);
      process.exit(1);
    }

    const config = loadConfig();
    const credentials = loadCredentials();
    logger.info(`Configuration chargée (model: ${config.provider.model})`);

    await initDatabase();
    logger.info("Base de données initialisée");

    // Initialize Claude client with credentials
    const apiKey = credentials.anthropic.apiKey || undefined;
    await ClaudeClient.initialize({ model: config.provider.model, apiKey });
    logger.info("Client Claude initialisé");

    initializeSkills();
    logger.info(`Skills initialisés`);

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
