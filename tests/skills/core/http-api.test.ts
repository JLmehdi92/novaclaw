// tests/skills/core/http-api.test.ts
import { describe, it, expect } from "vitest";
import { HttpApiSkill } from "../../../src/skills/core/http-api.js";

describe("HttpApiSkill", () => {
  const skill = new HttpApiSkill();
  const context = { workspace: "./data/test", userId: 123, chatId: 456 };

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
