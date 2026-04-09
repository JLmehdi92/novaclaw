// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, resetConfig } from "../src/config.js";

describe("Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  it("should load config from environment variables", () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_OWNER_ID = "123456789";
    process.env.TELEGRAM_ALLOWED_IDS = "123456789,987654321";
    process.env.CLAUDE_MODEL = "claude-sonnet-4-6";
    process.env.DATABASE_PATH = "./test.db";
    process.env.DEFAULT_LANGUAGE = "fr";

    const config = loadConfig();

    expect(config.telegram.botToken).toBe("test-token");
    expect(config.telegram.ownerId).toBe(123456789);
    expect(config.telegram.allowedIds).toEqual([123456789, 987654321]);
    expect(config.claude.model).toBe("claude-sonnet-4-6");
  });

  it("should throw error if required config is missing", () => {
    process.env.TELEGRAM_BOT_TOKEN = "";
    process.env.TELEGRAM_OWNER_ID = "";
    process.env.TELEGRAM_ALLOWED_IDS = "";

    expect(() => loadConfig()).toThrow();
  });
});
