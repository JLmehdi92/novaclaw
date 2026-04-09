#!/usr/bin/env node
// src/cli/index.ts
import { Command } from "commander";
import { setupCommand } from "./commands/setup.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { configCommand } from "./commands/config.js";
import { skillsCommand } from "./commands/skills-cmd.js";
import { serviceCommand } from "./commands/service.js";

const program = new Command();

program
  .name("novaclaw")
  .description("NovaClaw - Personal AI Agent for Telegram")
  .version("2.0.0");

// Core commands
program.addCommand(setupCommand);
program.addCommand(startCommand);
program.addCommand(statusCommand);

// Management commands
program.addCommand(configCommand);
program.addCommand(skillsCommand);
program.addCommand(serviceCommand);

program.parse();
