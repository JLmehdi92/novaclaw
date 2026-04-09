// src/storage/db.ts
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";
import { DatabaseError } from "../utils/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new DatabaseError("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export async function initDatabase(dbPath?: string): Promise<void> {
  const finalPath = dbPath || process.env.DATABASE_PATH || "./data/novaclaw.db";

  // Ensure directory exists
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    db = new Database(finalPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = OFF");

    // Run migrations
    await runMigrations();

    logger.info(`Database initialized at ${finalPath}`);
  } catch (error) {
    throw new DatabaseError(`Failed to initialize database: ${error}`);
  }
}

async function runMigrations(): Promise<void> {
  if (!db) throw new DatabaseError("Database not initialized");

  const migrationsDir = path.join(__dirname, "migrations");

  if (!fs.existsSync(migrationsDir)) {
    logger.warn("Migrations directory not found, skipping migrations");
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    try {
      db.exec(sql);
      logger.debug(`Migration applied: ${file}`);
    } catch (error) {
      throw new DatabaseError(`Migration failed: ${file}`, { error });
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info("Database connection closed");
  }
}
