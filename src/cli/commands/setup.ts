// src/cli/commands/setup.ts
import { Command } from "commander";

export const setupCommand = new Command("setup")
  .description("Configure NovaClaw with your API keys")
  .action(async () => {
    console.log("Setup command - to be implemented");
  });
