// src/storage/messages.ts
import { getDatabase } from "./db.js";

export interface Message {
  id: number;
  chat_id: number;
  user_id: number | null;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tokens_used: number | null;
  created_at: string;
}

export const messagesRepo = {
  create(data: {
    chatId: number;
    userId?: number;
    role: Message["role"];
    content: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    tokensUsed?: number;
  }): Message {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO messages (chat_id, user_id, role, content, tool_name, tool_args, tokens_used)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.chatId,
      data.userId || null,
      data.role,
      data.content,
      data.toolName || null,
      data.toolArgs ? JSON.stringify(data.toolArgs) : null,
      data.tokensUsed || null
    );
    return {
      id: result.lastInsertRowid as number,
      chat_id: data.chatId,
      user_id: data.userId || null,
      role: data.role,
      content: data.content,
      tool_name: data.toolName || null,
      tool_args: data.toolArgs || null,
      tokens_used: data.tokensUsed || null,
      created_at: new Date().toISOString(),
    };
  },

  getRecent(chatId: number, limit: number = 30): Message[] {
    const db = getDatabase();
    const rows = db
      .prepare(`
        SELECT * FROM messages
        WHERE chat_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(chatId, limit) as Message[];

    return rows.reverse().map((row) => ({
      ...row,
      tool_args: row.tool_args ? JSON.parse(row.tool_args as unknown as string) : null,
    }));
  },

  deleteByChat(chatId: number): number {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM messages WHERE chat_id = ?").run(chatId);
    return result.changes;
  },

  countByChat(chatId: number): number {
    const db = getDatabase();
    const row = db
      .prepare("SELECT COUNT(*) as count FROM messages WHERE chat_id = ?")
      .get(chatId) as { count: number };
    return row.count;
  },
};
