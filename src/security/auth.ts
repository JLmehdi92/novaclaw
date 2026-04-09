// src/security/auth.ts
import { loadConfig } from "../config/loader.js";
import { getDatabase } from "../storage/db.js";
import { logger } from "../utils/logger.js";

export const authManager = {
  isAllowed(telegramUserId: number): boolean {
    const config = loadConfig();
    const { ownerId, allowedUsers } = config.channels.telegram;
    // Owner is always allowed, plus any users in allowedUsers list
    return telegramUserId === ownerId || allowedUsers.includes(telegramUserId);
  },

  isOwner(telegramUserId: number): boolean {
    const config = loadConfig();
    return config.channels.telegram.ownerId === telegramUserId;
  },

  getAllowedIds(): number[] {
    const config = loadConfig();
    const { ownerId, allowedUsers } = config.channels.telegram;
    return [ownerId, ...allowedUsers];
  },

  logAction(userId: number, action: string, details?: Record<string, unknown>): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (?, ?, ?)
      `).run(userId, action, details ? JSON.stringify(details) : null);
    } catch (error) {
      logger.error(`Failed to log action: ${error}`);
    }
  },

  getRecentLogs(limit: number = 10): Array<{
    id: number;
    user_id: number;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }> {
    const db = getDatabase();
    const rows = db
      .prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Array<{
        id: number;
        user_id: number;
        action: string;
        details: string | null;
        created_at: string;
      }>;

    return rows.map((row) => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
    }));
  },
};
