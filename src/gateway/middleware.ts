// src/gateway/middleware.ts
import { Context, NextFunction } from "grammy";
import { authManager } from "../security/auth.js";
import { usersRepo } from "../storage/users.js";
import { logger } from "../utils/logger.js";

// Rate limiting: messages per user
const rateLimits = new Map<number, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // messages per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

export async function rateLimitMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }

  const now = Date.now();
  const userLimit = rateLimits.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // New window
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
  } else if (userLimit.count >= RATE_LIMIT) {
    // Rate limited
    const waitSeconds = Math.ceil((userLimit.resetAt - now) / 1000);
    logger.warn(`[RateLimit] User ${userId} rate limited`);
    await ctx.reply(`⏳ Trop de messages. Attends ${waitSeconds}s.`);
    return;
  } else {
    // Increment
    userLimit.count++;
  }

  await next();
}

export async function authMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const displayName = ctx.from?.first_name;

  if (!userId) {
    logger.warn("Message reçu sans user ID");
    return;
  }

  if (!authManager.isAllowed(userId)) {
    logger.warn(`Accès non autorisé: user ${userId}`);
    await ctx.reply("⛔ Accès non autorisé. Contacte l'administrateur.");
    return;
  }

  // Update or create user in DB
  try {
    usersRepo.getOrCreate(userId, username, displayName);
  } catch (error) {
    logger.error(`Erreur création user: ${error}`);
  }

  await next();
}

export async function loggingMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const start = Date.now();
  const userId = ctx.from?.id;
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "[non-text]";

  logger.info(`[${userId}] Reçu: ${text?.slice(0, 50)}...`);

  await next();

  const duration = Date.now() - start;
  logger.info(`[${userId}] Répondu en ${duration}ms`);
}
