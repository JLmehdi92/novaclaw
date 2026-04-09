// src/storage/memories.ts
import { getDatabase } from "./db.js";

export interface Memory {
  id: number;
  user_id: number | null;
  category: string;
  subcategory: string | null;
  key: string;
  value: string;
  summary: string | null;
  source: string | null;
  importance: number;
  confidence: number;
  last_accessed: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const memoriesRepo = {
  upsert(data: {
    userId: number;
    category: string;
    key: string;
    value: string;
    subcategory?: string;
    summary?: string;
    source?: string;
    importance?: number;
    confidence?: number;
    expiresAt?: string;
  }): Memory {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO memories (user_id, category, subcategory, key, value, summary, source, importance, confidence, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, category, key) DO UPDATE SET
        value = excluded.value,
        summary = excluded.summary,
        importance = excluded.importance,
        confidence = excluded.confidence,
        updated_at = datetime('now')
    `);
    stmt.run(
      data.userId,
      data.category,
      data.subcategory || null,
      data.key,
      data.value,
      data.summary || null,
      data.source || null,
      data.importance ?? 0.5,
      data.confidence ?? 1.0,
      data.expiresAt || null
    );
    return this.find(data.userId, data.category, data.key)!;
  },

  find(userId: number, category: string, key: string): Memory | undefined {
    const db = getDatabase();
    return db
      .prepare("SELECT * FROM memories WHERE user_id = ? AND category = ? AND key = ?")
      .get(userId, category, key) as Memory | undefined;
  },

  getByUser(userId: number, category?: string): Memory[] {
    const db = getDatabase();
    if (category) {
      return db
        .prepare("SELECT * FROM memories WHERE user_id = ? AND category = ? ORDER BY importance DESC")
        .all(userId, category) as Memory[];
    }
    return db
      .prepare("SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC")
      .all(userId) as Memory[];
  },

  search(userId: number, query: string): Memory[] {
    const db = getDatabase();
    return db
      .prepare(`
        SELECT * FROM memories
        WHERE user_id = ? AND (key LIKE ? OR value LIKE ? OR summary LIKE ?)
        ORDER BY importance DESC
        LIMIT 20
      `)
      .all(userId, `%${query}%`, `%${query}%`, `%${query}%`) as Memory[];
  },

  delete(userId: number, category: string, key: string): boolean {
    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM memories WHERE user_id = ? AND category = ? AND key = ?")
      .run(userId, category, key);
    return result.changes > 0;
  },

  deleteExpired(): number {
    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < datetime('now')")
      .run();
    return result.changes;
  },
};
