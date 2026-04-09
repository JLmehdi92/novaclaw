// tests/storage/db.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = "./data/test-novaclaw.db";

describe("Database", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DB_PATH;
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it("should initialize database and create tables", async () => {
    const { initDatabase, getDatabase, closeDatabase } = await import("../../src/storage/db.js");

    await initDatabase();
    const db = getDatabase();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("users");
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("messages");
    expect(tableNames).toContain("memories");
    expect(tableNames).toContain("audit_logs");
    expect(tableNames).toContain("scheduled_tasks");

    closeDatabase();
  });
});
