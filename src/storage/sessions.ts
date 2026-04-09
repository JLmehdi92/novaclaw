// src/storage/sessions.ts
import { getDatabase } from "./db.js";

export interface Session {
  id: number;
  chat_id: number;
  user_id: number | null;
  claude_session_id: string | null;
  status: "active" | "paused" | "archived";
  created_at: string;
  last_activity: string | null;
}

export const sessionsRepo = {
  findByChatId(chatId: number): Session | undefined {
    const db = getDatabase();
    return db
      .prepare("SELECT * FROM sessions WHERE chat_id = ? AND status = 'active'")
      .get(chatId) as Session | undefined;
  },

  create(chatId: number, userId?: number): Session {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO sessions (chat_id, user_id, last_activity)
      VALUES (?, ?, datetime('now'))
    `);
    const result = stmt.run(chatId, userId || null);
    return {
      id: result.lastInsertRowid as number,
      chat_id: chatId,
      user_id: userId || null,
      claude_session_id: null,
      status: "active",
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    };
  },

  getOrCreate(chatId: number, userId?: number): Session {
    let session = this.findByChatId(chatId);
    if (!session) {
      session = this.create(chatId, userId);
    }
    return session;
  },

  updateClaudeSessionId(sessionId: number, claudeSessionId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE sessions SET claude_session_id = ?, last_activity = datetime('now')
      WHERE id = ?
    `).run(claudeSessionId, sessionId);
  },

  updateLastActivity(sessionId: number): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE sessions SET last_activity = datetime('now') WHERE id = ?
    `).run(sessionId);
  },

  archive(chatId: number): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE sessions SET status = 'archived' WHERE chat_id = ? AND status = 'active'
    `).run(chatId);
  },

  reset(chatId: number): void {
    this.archive(chatId);
  },
};
