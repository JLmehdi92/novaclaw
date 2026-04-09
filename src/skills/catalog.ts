// src/skills/catalog.ts
import { BaseSkill, SkillMetadata } from "./base.js";
import { SkillsRegistry } from "./registry.js";

export function getSkillsCatalog(): SkillMetadata[] {
  return SkillsRegistry.getAll().map(skill => skill.getMetadata());
}

export function getSkillsByCategory(category: string): SkillMetadata[] {
  return getSkillsCatalog().filter(s => s.category === category);
}

export function isSkillAvailable(skillId: string): boolean {
  return SkillsRegistry.has(skillId);
}
