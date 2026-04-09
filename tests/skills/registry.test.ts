// tests/skills/registry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { SkillsRegistry } from "../../src/skills/registry.js";
import { BaseSkill, SkillContext } from "../../src/skills/base.js";

class TestSkill extends BaseSkill {
  name = "test_skill";
  description = "A test skill";
  parameters = {
    type: "object" as const,
    properties: {
      message: { type: "string" },
    },
    required: ["message"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    return `Test: ${args.message}`;
  }
}

describe("SkillsRegistry", () => {
  beforeEach(() => {
    SkillsRegistry.clear();
  });

  it("should register and retrieve a skill", () => {
    const skill = new TestSkill();
    SkillsRegistry.register(skill);

    const retrieved = SkillsRegistry.get("test_skill");
    expect(retrieved).toBe(skill);
  });

  it("should return all tool definitions", () => {
    const skill = new TestSkill();
    SkillsRegistry.register(skill);

    const definitions = SkillsRegistry.getToolDefinitions();
    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe("test_skill");
  });

  it("should return undefined for unknown skill", () => {
    const skill = SkillsRegistry.get("unknown");
    expect(skill).toBeUndefined();
  });
});
