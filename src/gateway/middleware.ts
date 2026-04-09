// src/gateway/middleware.ts
import { Context, NextFunction } from "grammy";
import { authManager } from "../security/auth.js";
import { usersRepo } from "../storage/users.js";
import { logger } from "../utils/logger.js";

export async function authMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const displayName = ctx.from?.first_name;

  if (!userId) {
    logger.warn("Message received without user ID");
    return;
  }

  if (!authManager.isAllowed(userId)) {
    logger.warn(`Unauthorized access attempt from user ${userId}`);
    await ctx.reply("⛔ Accès non autorisé. Contacte l'administrateur.");
    return;
  }

  usersRepo.getOrCreate(userId, username, displayName);
  await next();
}

export async function loggingMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const start = Date.now();
  const userId = ctx.from?.id;
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "[non-text]";

  logger.info(`[${userId}] Received: ${text?.slice(0, 50)}...`);
  await next();
  const duration = Date.now() - start;
  logger.info(`[${userId}] Responded in ${duration}ms`);
}
