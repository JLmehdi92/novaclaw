// src/skills/init.ts
import { SkillsRegistry } from "./registry.js";
import { FileOpsSkill } from "./core/file-ops.js";
import { RunCodeSkill } from "./core/run-code.js";
import { HttpApiSkill } from "./core/http-api.js";
import { ShellExecSkill } from "./core/shell-exec.js";
import { BrowserSkill } from "./web/browser.js";
import { ScreenshotSkill } from "./web/screenshot.js";
import { WebScraperSkill } from "./web/web-scraper.js";
import { PdfReaderSkill } from "./web/pdf-reader.js";
import { LinkPreviewSkill } from "./web/link-preview.js";
import { WebMonitorSkill } from "./web/web-monitor.js";
import { logger } from "../utils/logger.js";

export function initializeSkills(): void {
  // Core skills
  SkillsRegistry.register(new FileOpsSkill());
  SkillsRegistry.register(new RunCodeSkill());
  SkillsRegistry.register(new HttpApiSkill());
  SkillsRegistry.register(new ShellExecSkill());

  // Web & Browser skills
  SkillsRegistry.register(new BrowserSkill());
  SkillsRegistry.register(new ScreenshotSkill());
  SkillsRegistry.register(new WebScraperSkill());
  SkillsRegistry.register(new PdfReaderSkill());
  SkillsRegistry.register(new LinkPreviewSkill());
  SkillsRegistry.register(new WebMonitorSkill());

  logger.info(`Initialized ${SkillsRegistry.count()} skills`);
}
