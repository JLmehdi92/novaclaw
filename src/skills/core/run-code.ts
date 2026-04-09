// src/skills/core/run-code.ts
import { BaseSkill, SkillContext } from "../base.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { authManager } from "../../security/auth.js";

const execAsync = promisify(exec);

// Dangerous patterns to block in code
const DANGEROUS_PATTERNS = [
  /process\.env/i,           // Environment access
  /require\s*\(\s*['"]child_process/i,  // Child process
  /require\s*\(\s*['"]fs/i,  // File system (direct require)
  /import\s+.*from\s+['"]child_process/i,
  /import\s+.*from\s+['"]fs/i,
  /exec\s*\(/i,              // exec calls
  /spawn\s*\(/i,             // spawn calls
  /eval\s*\(/i,              // eval
  /Function\s*\(/i,          // Function constructor
  /__import__/i,             // Python import
  /subprocess/i,             // Python subprocess
  /os\.system/i,             // Python os.system
  /os\.popen/i,              // Python os.popen
  /shutil\.rmtree/i,         // Python recursive delete
];

export class RunCodeSkill extends BaseSkill {
  name = "run_code";
  description = "Exécuter du code JavaScript ou Python (avec restrictions de sécurité)";
  category = "code";
  parameters = {
    type: "object" as const,
    properties: {
      language: {
        type: "string",
        enum: ["javascript", "python"],
        description: "Langage de programmation",
      },
      code: {
        type: "string",
        description: "Le code à exécuter",
      },
    },
    required: ["language", "code"],
  };

  private readonly TIMEOUT = 30000;
  private readonly MAX_OUTPUT = 100000; // 100KB
  private readonly MAX_CODE_LENGTH = 50000; // 50KB

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const language = args.language as string;
    const code = args.code as string;

    if (!code || typeof code !== "string") {
      throw new SkillError("Code invalide");
    }

    if (code.length > this.MAX_CODE_LENGTH) {
      throw new SkillError(`Code trop long (max ${this.MAX_CODE_LENGTH} caractères)`);
    }

    // Check for dangerous patterns (non-owners only)
    if (!authManager.isOwner(context.userId)) {
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
          throw new SkillError("Code contient des patterns non autorisés (accès système)");
        }
      }
    }

    const filename = language === "python" ? "script.py" : "script.js";
    const filepath = path.resolve(context.workspace, filename);

    // Ensure workspace exists
    if (!fs.existsSync(context.workspace)) {
      fs.mkdirSync(context.workspace, { recursive: true });
    }

    // Write code to file
    fs.writeFileSync(filepath, code, "utf-8");

    try {
      logger.info(`[RunCode] User ${context.userId} executing ${language} code (${code.length} chars)`);

      let command: string;

      if (language === "python") {
        // Python with restricted mode hints
        command = `python -u "${filepath}"`;
      } else {
        // Node.js with some restrictions via flags
        command = `node --disallow-code-generation-from-strings "${filepath}"`;
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: this.TIMEOUT,
        cwd: context.workspace,
        maxBuffer: this.MAX_OUTPUT,
        env: {
          ...process.env,
          // Limit some environment exposure
          PATH: process.env.PATH,
          HOME: context.workspace,
          USERPROFILE: context.workspace,
          TMPDIR: context.workspace,
          TEMP: context.workspace,
          TMP: context.workspace,
        },
      });

      const output = (stdout || stderr || "(aucune sortie)").trim();

      authManager.logAction(context.userId, "code_execution", {
        language,
        codeLength: code.length,
        success: true,
      });

      if (output.length > this.MAX_OUTPUT) {
        return output.slice(0, this.MAX_OUTPUT) + "\n... (sortie tronquée)";
      }

      return output;
    } catch (error: unknown) {
      authManager.logAction(context.userId, "code_execution", {
        language,
        codeLength: code.length,
        success: false,
        error: error instanceof Error ? error.message.slice(0, 200) : "Unknown",
      });

      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string; stdout?: string; killed?: boolean };

        if (execError.killed) {
          return "Erreur: Exécution interrompue (timeout 30s ou limite mémoire)";
        }

        // Return stderr or stdout for error details
        const errorOutput = execError.stderr || execError.stdout || execError.message;
        return `Erreur: ${errorOutput.slice(0, 2000)}`;
      }
      return `Erreur: ${String(error)}`;
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
