// src/core/memory.ts
import { messagesRepo, Message } from "../storage/messages.js";
import { memoriesRepo } from "../storage/memories.js";
import { usersRepo } from "../storage/users.js";

export interface ConversationContext {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  memories: Array<{ key: string; value: string }>;
}

/**
 * Get or create user and return internal database user ID
 */
function getOrCreateInternalUserId(telegramUserId: number): number {
  const user = usersRepo.getOrCreate(telegramUserId);
  return user.id;
}

export const memoryManager = {
  async buildContext(chatId: number, telegramUserId: number): Promise<ConversationContext> {
    const recentMessages = messagesRepo.getRecent(chatId, 30);
    const internalUserId = getOrCreateInternalUserId(telegramUserId);
    const memories = memoriesRepo.getByUser(internalUserId).slice(0, 10);

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
    // Get or create user and use internal database ID
    const internalUserId = getOrCreateInternalUserId(telegramUserId);
    messagesRepo.create({
      chatId,
      userId: internalUserId,
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
    const internalUserId = getOrCreateInternalUserId(telegramUserId);
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
