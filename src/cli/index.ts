#!/usr/bin/env node
// src/cli/index.ts
import { Command } from "commander";
import { setupCommand } from "./commands/setup.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("novaclaw")
  .description("NovaClaw - Personal AI Agent for Telegram")
  .version("1.0.0");

program.addCommand(setupCommand);
program.addCommand(startCommand);
program.addCommand(statusCommand);

program.parse();
