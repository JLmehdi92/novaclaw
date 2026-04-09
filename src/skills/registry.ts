// src/skills/registry.ts
import { BaseSkill, SkillDefinition } from "./base.js";
import { logger } from "../utils/logger.js";

class SkillsRegistryClass {
  private skills: Map<string, BaseSkill> = new Map();

  register(skill: BaseSkill): void {
    this.skills.set(skill.name, skill);
    logger.debug(`Skill registered: ${skill.name}`);
  }

  get(name: string): BaseSkill | undefined {
    return this.skills.get(name);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  getAll(): BaseSkill[] {
    return Array.from(this.skills.values());
  }

  getToolDefinitions(): SkillDefinition[] {
    return this.getAll().map((skill) => skill.getDefinition());
  }

  count(): number {
    return this.skills.size;
  }

  clear(): void {
    this.skills.clear();
  }

  getNames(): string[] {
    return Array.from(this.skills.keys());
  }
}

export const SkillsRegistry = new SkillsRegistryClass();
