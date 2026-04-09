// src/skills/init.ts
import { SkillsRegistry } from "./registry.js";
import { FileOpsSkill } from "./core/file-ops.js";
import { RunCodeSkill } from "./core/run-code.js";
import { HttpApiSkill } from "./core/http-api.js";
import { ShellExecSkill } from "./core/shell-exec.js";
import { BrowserSkill } from "./core/browser.js";
import { logger } from "../utils/logger.js";

export function initializeSkills(): void {
  // Core skills
  SkillsRegistry.register(new FileOpsSkill());
  SkillsRegistry.register(new RunCodeSkill());
  SkillsRegistry.register(new HttpApiSkill());
  SkillsRegistry.register(new ShellExecSkill());
  SkillsRegistry.register(new BrowserSkill());

  logger.info(`Initialized ${SkillsRegistry.count()} skills`);
}
