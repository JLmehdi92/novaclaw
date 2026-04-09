// src/core/session.ts
import { sessionsRepo, Session } from "../storage/sessions.js";

export const sessionManager = {
  getOrCreate(chatId: number, userId?: number): Session {
    return sessionsRepo.getOrCreate(chatId, userId);
  },

  updateClaudeSession(sessionId: number, claudeSessionId: string): void {
    sessionsRepo.updateClaudeSessionId(sessionId, claudeSessionId);
  },

  reset(chatId: number): void {
    sessionsRepo.reset(chatId);
  },

  getSession(chatId: number): Session | undefined {
    return sessionsRepo.findByChatId(chatId);
  },
};
