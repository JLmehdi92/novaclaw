// tests/skills/core/http-api.test.ts
import { describe, it, expect, beforeAll } from "vitest";

// Setup test environment before importing modules that use config
process.env.TELEGRAM_BOT_TOKEN = "test-token-12345678901234567890";
process.env.TELEGRAM_OWNER_ID = "123";
process.env.TELEGRAM_ALLOWED_IDS = "123";

import { HttpApiSkill } from "../../../src/skills/core/http-api.js";
import { resetConfig } from "../../../src/config.js";

describe("HttpApiSkill", () => {
  const skill = new HttpApiSkill();
  const context = { workspace: "./data/test", userId: 123, chatId: 456 };

  beforeAll(() => {
    resetConfig();
  });

  it("should make GET request", async () => {
    const result = await skill.execute(
      { method: "GET", url: "https://httpbin.org/get" },
      context
    );
    const data = JSON.parse(result);
    expect(data.url).toBe("https://httpbin.org/get");
  });

  it("should make POST request with body", async () => {
    const result = await skill.execute(
      {
        method: "POST",
        url: "https://httpbin.org/post",
        body: JSON.stringify({ test: "value" }),
        headers: { "Content-Type": "application/json" },
      },
      context
    );
    const data = JSON.parse(result);
    expect(data.json).toEqual({ test: "value" });
  });

  it("should handle errors", async () => {
    const result = await skill.execute(
      { method: "GET", url: "https://httpbin.org/status/404" },
      context
    );
    expect(result).toContain("404");
  });
});
