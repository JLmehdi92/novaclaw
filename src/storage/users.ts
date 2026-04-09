// src/storage/users.ts
import { getDatabase } from "./db.js";

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  display_name: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  last_seen: string | null;
}

export const usersRepo = {
  findByTelegramId(telegramId: number): User | undefined {
    const db = getDatabase();
    const row = db
      .prepare("SELECT * FROM users WHERE telegram_id = ?")
      .get(telegramId) as User | undefined;

    if (row) {
      try {
        row.preferences = JSON.parse(row.preferences as unknown as string || "{}");
      } catch {
        row.preferences = {};
      }
    }
    return row;
  },

  create(telegramId: number, username?: string, displayName?: string): User {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (telegram_id, username, display_name)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(telegramId, username || null, displayName || null);
    return this.findByTelegramId(telegramId)!;
  },

  updateLastSeen(telegramId: number): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE users SET last_seen = datetime('now') WHERE telegram_id = ?
    `).run(telegramId);
  },

  getOrCreate(telegramId: number, username?: string, displayName?: string): User {
    let user = this.findByTelegramId(telegramId);
    if (!user) {
      user = this.create(telegramId, username, displayName);
    }
    this.updateLastSeen(telegramId);
    return user;
  },

  getAll(): User[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM users").all() as User[];
    return rows.map((row) => ({
      ...row,
      preferences: (() => {
        try {
          return JSON.parse(row.preferences as unknown as string || "{}");
        } catch {
          return {};
        }
      })(),
    }));
  },

  delete(telegramId: number): boolean {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM users WHERE telegram_id = ?").run(telegramId);
    return result.changes > 0;
  },
};
