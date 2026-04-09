// src/core/memory.ts
// Simplified: uses telegram_id directly, no FK constraints
import { messagesRepo } from "../storage/messages.js";
import { memoriesRepo } from "../storage/memories.js";

export interface ConversationContext {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  memories: Array<{ key: string; value: string }>;
}

export const memoryManager = {
  async buildContext(chatId: number, telegramUserId: number): Promise<ConversationContext> {
    const recentMessages = messagesRepo.getRecent(chatId, 30);
    const memories = memoriesRepo.getByUser(telegramUserId).slice(0, 10);

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
    userId: number,
    role: "user" | "assistant",
    content: string
  ): Promise<void> {
    messagesRepo.create({ chatId, userId, role, content });
  },

  async remember(
    userId: number,
    category: string,
    key: string,
    value: string
  ): Promise<void> {
    memoriesRepo.upsert({ userId, category, key, value });
  },

  async recall(userId: number, query: string): Promise<string[]> {
    const results = memoriesRepo.search(userId, query);
    return results.map((m) => m.value);
  },

  async clearChat(chatId: number): Promise<number> {
    return messagesRepo.deleteByChat(chatId);
  },
};
