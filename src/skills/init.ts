// src/skills/init.ts
import { SkillsRegistry } from "./registry.js";
import { HttpApiSkill } from "./core/http-api.js";
import { CodeRunnerSkill } from "./code/code-runner.js";
import { CodeAnalyzerSkill } from "./code/code-analyzer.js";
import { GitSkill } from "./code/git.js";
import { GitHubSkill } from "./code/github.js";
import { DockerSkill } from "./code/docker.js";
import { DatabaseSkill } from "./code/database.js";
import { ApiTesterSkill } from "./code/api-tester.js";
import { BrowserSkill } from "./web/browser.js";
import { ScreenshotSkill } from "./web/screenshot.js";
import { WebScraperSkill } from "./web/web-scraper.js";
import { PdfReaderSkill } from "./web/pdf-reader.js";
import { LinkPreviewSkill } from "./web/link-preview.js";
import { WebMonitorSkill } from "./web/web-monitor.js";
import { ShellSkill } from "./system/shell.js";
import { ProcessManagerSkill } from "./system/process-manager.js";
import { SystemInfoSkill } from "./system/system-info.js";
import { PackageManagerSkill } from "./system/package-manager.js";
import { ServiceManagerSkill } from "./system/service-manager.js";
import { CronSchedulerSkill } from "./system/cron-scheduler.js";
import { FilesSkill } from "./files/files.js";
import { FileSearchSkill } from "./files/file-search.js";
import { ArchiveSkill } from "./files/archive.js";
import { FileConvertSkill } from "./files/file-convert.js";
import { FileWatchSkill } from "./files/file-watch.js";
import { CloudStorageSkill } from "./files/cloud-storage.js";
import { logger } from "../utils/logger.js";

export function initializeSkills(): void {
  // Core skills
  SkillsRegistry.register(new HttpApiSkill());

  // Code & Dev skills
  SkillsRegistry.register(new CodeRunnerSkill());
  SkillsRegistry.register(new CodeAnalyzerSkill());
  SkillsRegistry.register(new GitSkill());
  SkillsRegistry.register(new GitHubSkill());
  SkillsRegistry.register(new DockerSkill());
  SkillsRegistry.register(new DatabaseSkill());
  SkillsRegistry.register(new ApiTesterSkill());

  // Web & Browser skills
  SkillsRegistry.register(new BrowserSkill());
  SkillsRegistry.register(new ScreenshotSkill());
  SkillsRegistry.register(new WebScraperSkill());
  SkillsRegistry.register(new PdfReaderSkill());
  SkillsRegistry.register(new LinkPreviewSkill());
  SkillsRegistry.register(new WebMonitorSkill());

  // System skills
  SkillsRegistry.register(new ShellSkill());
  SkillsRegistry.register(new ProcessManagerSkill());
  SkillsRegistry.register(new SystemInfoSkill());
  SkillsRegistry.register(new PackageManagerSkill());
  SkillsRegistry.register(new ServiceManagerSkill());
  SkillsRegistry.register(new CronSchedulerSkill());

  // Files & Storage skills
  SkillsRegistry.register(new FilesSkill());
  SkillsRegistry.register(new FileSearchSkill());
  SkillsRegistry.register(new ArchiveSkill());
  SkillsRegistry.register(new FileConvertSkill());
  SkillsRegistry.register(new FileWatchSkill());
  SkillsRegistry.register(new CloudStorageSkill());

  logger.info(`Initialized ${SkillsRegistry.count()} skills`);
}
