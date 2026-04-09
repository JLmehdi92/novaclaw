// tests/skills/core/run-code.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";

// Setup test environment before importing modules that use config
process.env.TELEGRAM_BOT_TOKEN = "test-token-12345678901234567890";
process.env.TELEGRAM_OWNER_ID = "123";
process.env.TELEGRAM_ALLOWED_IDS = "123";

import { RunCodeSkill } from "../../../src/skills/core/run-code.js";
import { resetConfig } from "../../../src/config.js";

const TEST_WORKSPACE = "./data/test-workspace-code";

describe("RunCodeSkill", () => {
  const skill = new RunCodeSkill();
  const context = { workspace: TEST_WORKSPACE, userId: 123, chatId: 456 };

  beforeAll(() => {
    resetConfig();
    fs.mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it("should execute JavaScript code", async () => {
    const result = await skill.execute(
      { language: "javascript", code: "console.log(2 + 2)" },
      context
    );
    expect(result.trim()).toBe("4");
  });

  it("should execute Python code", async () => {
    const result = await skill.execute(
      { language: "python", code: "print(3 * 3)" },
      context
    );
    expect(result.trim()).toBe("9");
  });

  it("should handle errors gracefully", async () => {
    const result = await skill.execute(
      { language: "javascript", code: "throw new Error('test error')" },
      context
    );
    expect(result).toContain("Error");
  });
});
