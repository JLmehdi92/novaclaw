// src/core/memory.ts
import { messagesRepo, Message } from "../storage/messages.js";
import { memoriesRepo } from "../storage/memories.js";
import { usersRepo } from "../storage/users.js";

export interface ConversationContext {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  memories: Array<{ key: string; value: string }>;
}

/**
 * Convert Telegram user ID to internal database user ID
 */
function getInternalUserId(telegramUserId: number): number | null {
  const user = usersRepo.findByTelegramId(telegramUserId);
  return user?.id || null;
}

export const memoryManager = {
  async buildContext(chatId: number, telegramUserId: number): Promise<ConversationContext> {
    const recentMessages = messagesRepo.getRecent(chatId, 30);
    const internalUserId = getInternalUserId(telegramUserId);
    const memories = internalUserId ? memoriesRepo.getByUser(internalUserId).slice(0, 10) : [];

    return {
      messages: recentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      memories: memories.map((m) => ({
        key: m.key,
        value: m.value,
      })),
    };
  },

  async appendMessage(
    chatId: number,
    telegramUserId: number,
    role: "user" | "assistant",
    content: string
  ): Promise<void> {
    // Convert Telegram ID to internal database user ID
    const internalUserId = getInternalUserId(telegramUserId);
    messagesRepo.create({
      chatId,
      userId: internalUserId || undefined,
      role,
      content,
    });
  },

  async remember(
    telegramUserId: number,
    category: string,
    key: string,
    value: string
  ): Promise<void> {
    const internalUserId = getInternalUserId(telegramUserId);
    if (!internalUserId) return;
    memoriesRepo.upsert({
      userId: internalUserId,
      category,
      key,
      value,
    });
  },

  async recall(userId: number, query: string): Promise<string[]> {
    const results = memoriesRepo.search(userId, query);
    return results.map((m) => m.value);
  },

  async clearChat(chatId: number): Promise<number> {
    return messagesRepo.deleteByChat(chatId);
  },
};
