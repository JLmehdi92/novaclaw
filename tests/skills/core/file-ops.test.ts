// tests/skills/core/file-ops.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FileOpsSkill } from "../../../src/skills/core/file-ops.js";
import fs from "fs";
import path from "path";

const TEST_WORKSPACE = "./data/test-workspace";

describe("FileOpsSkill", () => {
  const skill = new FileOpsSkill();
  const context = { workspace: TEST_WORKSPACE, userId: 123, chatId: 456 };

  beforeAll(() => {
    fs.mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  });

  it("should write a file", async () => {
    const result = await skill.execute(
      { action: "write", path: "test.txt", content: "Hello World" },
      context
    );
    expect(result).toContain("written");

    const fullPath = path.join(TEST_WORKSPACE, "test.txt");
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.readFileSync(fullPath, "utf-8")).toBe("Hello World");
  });

  it("should read a file", async () => {
    const result = await skill.execute(
      { action: "read", path: "test.txt" },
      context
    );
    expect(result).toBe("Hello World");
  });

  it("should list files", async () => {
    const result = await skill.execute(
      { action: "list", path: "." },
      context
    );
    expect(result).toContain("test.txt");
  });

  it("should delete a file", async () => {
    const result = await skill.execute(
      { action: "delete", path: "test.txt" },
      context
    );
    expect(result).toContain("deleted");

    const fullPath = path.join(TEST_WORKSPACE, "test.txt");
    expect(fs.existsSync(fullPath)).toBe(false);
  });
});
