// src/skills/core/shell-exec.ts
import { BaseSkill, SkillContext } from "../base.js";
import { exec } from "child_process";
import { promisify } from "util";
import { SkillError } from "../../utils/errors.js";
import { authManager } from "../../security/auth.js";

const execAsync = promisify(exec);

export class ShellExecSkill extends BaseSkill {
  name = "shell_exec";
  description = "Execute shell commands (owner only for dangerous commands)";
  parameters = {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
    },
    required: ["command"],
  };

  private readonly TIMEOUT = 60000; // 60 seconds
  private readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf/i,
    /rmdir/i,
    /del\s+\/[sq]/i,
    /format/i,
    /shutdown/i,
    /reboot/i,
  ];

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const command = args.command as string;

    // Check for dangerous commands
    if (this.isDangerous(command) && !authManager.isOwner(context.userId)) {
      throw new SkillError("This command requires owner privileges");
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.TIMEOUT,
        cwd: context.workspace,
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
      });

      const output = stdout || stderr || "(no output)";

      // Log the action
      authManager.logAction(context.userId, "shell_command", { command });

      return output.trim();
    } catch (error: unknown) {
      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string; code?: number };
        return `Error (code ${execError.code || "unknown"}): ${execError.stderr || execError.message}`;
      }
      return `Error: ${String(error)}`;
    }
  }

  private isDangerous(command: string): boolean {
    return this.DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }
}
