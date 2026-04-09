// src/skills/core/run-code.ts
import { BaseSkill, SkillContext } from "../base.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { SkillError } from "../../utils/errors.js";

const execAsync = promisify(exec);

export class RunCodeSkill extends BaseSkill {
  name = "run_code";
  description = "Execute JavaScript or Python code and return the output";
  parameters = {
    type: "object" as const,
    properties: {
      language: {
        type: "string",
        enum: ["javascript", "python"],
        description: "Programming language to use",
      },
      code: {
        type: "string",
        description: "The code to execute",
      },
    },
    required: ["language", "code"],
  };

  private readonly TIMEOUT = 30000; // 30 seconds

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const language = args.language as string;
    const code = args.code as string;

    const workspaceAbsolute = path.resolve(context.workspace);
    const filename = language === "python" ? "script.py" : "script.js";
    const filepath = path.join(workspaceAbsolute, filename);

    // Write code to file
    fs.writeFileSync(filepath, code, "utf-8");

    try {
      const command = language === "python" ? `python "${filepath}"` : `node "${filepath}"`;

      const { stdout, stderr } = await execAsync(command, {
        timeout: this.TIMEOUT,
        cwd: workspaceAbsolute,
      });

      const output = stdout || stderr || "(no output)";
      return output.trim();
    } catch (error: unknown) {
      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string; stdout?: string };
        return `Error: ${execError.stderr || execError.message}`;
      }
      return `Error: ${String(error)}`;
    } finally {
      // Cleanup
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
  }
}
