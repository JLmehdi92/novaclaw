// src/skills/system/shell.ts
import { BaseSkill, SkillContext } from "../base.js";
import { exec } from "child_process";
import { promisify } from "util";
import { SkillError } from "../../utils/errors.js";
import { authManager } from "../../security/auth.js";
import { logger } from "../../utils/logger.js";

const execAsync = promisify(exec);

// Allowlist of safe commands for non-owners
const ALLOWED_COMMANDS = [
  "ls", "dir", "pwd", "cd", "echo", "cat", "head", "tail", "grep", "find",
  "wc", "sort", "uniq", "diff", "date", "whoami", "hostname", "uname",
  "node", "npm", "python", "pip", "git", "curl", "wget",
  "mkdir", "touch", "cp", "mv", "type", "where", "which",
];

// Commands that require owner privileges
const OWNER_ONLY_COMMANDS = [
  "rm", "rmdir", "del", "rd", "format", "shutdown", "reboot", "kill",
  "pkill", "taskkill", "net", "netsh", "reg", "regedit", "chmod", "chown",
  "sudo", "su", "apt", "yum", "brew", "choco",
];

export class ShellSkill extends BaseSkill {
  name = "shell_exec";
  description = "Exécuter des commandes shell (commandes dangereuses réservées à l'owner)";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "La commande shell à exécuter",
      },
    },
    required: ["command"],
  };

  private readonly TIMEOUT = 60000;
  private readonly MAX_OUTPUT = 50000; // 50KB max output

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const command = args.command as string;

    if (!command || typeof command !== "string") {
      throw new SkillError("Commande invalide");
    }

    // Extract the base command (first word)
    const baseCommand = this.extractBaseCommand(command);
    const isOwner = authManager.isOwner(context.userId);

    // Check if command is allowed
    if (!isOwner) {
      if (OWNER_ONLY_COMMANDS.includes(baseCommand.toLowerCase())) {
        throw new SkillError(`Commande "${baseCommand}" réservée à l'owner`);
      }

      if (!ALLOWED_COMMANDS.includes(baseCommand.toLowerCase())) {
        throw new SkillError(
          `Commande "${baseCommand}" non autorisée. Commandes permises: ${ALLOWED_COMMANDS.slice(0, 10).join(", ")}...`
        );
      }

      // Block dangerous patterns even in allowed commands
      if (this.containsDangerousPatterns(command)) {
        throw new SkillError("Pattern dangereux détecté dans la commande");
      }
    }

    try {
      logger.info(`[Shell] User ${context.userId} executing: ${command.slice(0, 100)}`);

      const { stdout, stderr } = await execAsync(command, {
        timeout: this.TIMEOUT,
        cwd: context.workspace,
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
        maxBuffer: this.MAX_OUTPUT,
      });

      const output = (stdout || stderr || "(aucune sortie)").trim();

      // Log the action
      authManager.logAction(context.userId, "shell_command", {
        command: command.slice(0, 200),
        success: true
      });

      // Truncate if too long
      if (output.length > this.MAX_OUTPUT) {
        return output.slice(0, this.MAX_OUTPUT) + "\n... (sortie tronquée)";
      }

      return output;
    } catch (error: unknown) {
      authManager.logAction(context.userId, "shell_command", {
        command: command.slice(0, 200),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string; code?: number; killed?: boolean };

        if (execError.killed) {
          return "Erreur: Commande interrompue (timeout ou limite mémoire)";
        }

        return `Erreur (code ${execError.code || "?"}): ${execError.stderr || execError.message}`;
      }
      return `Erreur: ${String(error)}`;
    }
  }

  private extractBaseCommand(command: string): string {
    // Remove leading whitespace and get first word
    const trimmed = command.trim();

    // Handle command substitution attempts
    if (trimmed.startsWith("$(") || trimmed.startsWith("`")) {
      return "__BLOCKED__";
    }

    // Get first word (the actual command)
    const match = trimmed.match(/^[\w\-\.]+/);
    return match ? match[0] : "__BLOCKED__";
  }

  private containsDangerousPatterns(command: string): boolean {
    const dangerous = [
      /\$\(.*\)/,           // Command substitution $(...)
      /`.*`/,               // Backtick substitution
      /[;&|]{2}/,           // Command chaining with && or ||
      /[|;].*rm/i,          // Piping to rm
      /[|;].*del/i,         // Piping to del
      />\s*\/dev\/sd/,      // Writing to block devices
      />\s*\\\\.\\PhysicalDrive/, // Windows physical drives
      /--no-preserve-root/, // rm without protection
      /:(){ :|:& };:/,      // Fork bomb
      /\/dev\/null.*</,     // Potential data destruction
    ];

    return dangerous.some(pattern => pattern.test(command));
  }
}
