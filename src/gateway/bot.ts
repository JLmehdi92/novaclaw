// src/gateway/bot.ts
import { Bot } from "grammy";
import { loadConfig } from "../config.js";
import { authMiddleware, loggingMiddleware, rateLimitMiddleware } from "./middleware.js";
import { registerCommands } from "./commands/telegram-commands.js";
import { novaClawAgent } from "../core/agent.js";
import { logger } from "../utils/logger.js";

let bot: Bot | null = null;

export async function startBot(): Promise<void> {
  const config = loadConfig();
  
  bot = new Bot(config.telegram.botToken);

  // Middleware
  bot.use(loggingMiddleware);
  bot.use(rateLimitMiddleware);
  bot.use(authMiddleware);

  // Commands
  registerCommands(bot);

  // Handle text messages
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from?.id;
    const text = ctx.message.text;

    if (!userId) return;

    // Skip if it's a command
    if (text.startsWith("/")) return;

    try {
      await ctx.replyWithChatAction("typing");
      const response = await novaClawAgent.handleMessage(chatId, userId, text);
      await ctx.reply(response, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error(`Bot error: ${error}`);
      await ctx.reply("❌ Une erreur s'est produite. Réessaie.");
    }
  });

  // Start
  logger.info("Starting Telegram bot...");
  await bot.start({
    onStart: (botInfo) => {
      logger.info(`Bot started as @${botInfo.username}`);
    },
  });
}

export function stopBot(): void {
  if (bot) {
    bot.stop();
    logger.info("Bot stopped");
  }
}
