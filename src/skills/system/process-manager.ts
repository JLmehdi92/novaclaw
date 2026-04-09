import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";
import os from "os";

export class ProcessManagerSkill extends BaseSkill {
  name = "process-manager";
  description = "Lister, surveiller et gérer les processus système";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["list", "kill", "find"], description: "Action" },
      pid: { type: "number", description: "PID du processus" },
      name: { type: "string", description: "Nom du processus" },
      limit: { type: "number", description: "Nombre max de résultats" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const isWindows = os.platform() === "win32";

    if (action === "list") {
      const limit = (args.limit as number) || 20;
      if (isWindows) {
        const output = execSync("tasklist /FO CSV /NH", { encoding: "utf-8" });
        return output.trim().split("\n").slice(0, limit).join("\n");
      }
      return execSync(`ps aux --sort=-%mem | head -${limit + 1}`, { encoding: "utf-8" });
    }
    if (action === "kill") {
      const pid = args.pid as number;
      if (!pid) throw new Error("PID requis");
      if (isWindows) execSync(`taskkill /PID ${pid} /F`);
      else execSync(`kill -9 ${pid}`);
      return `Processus ${pid} terminé`;
    }
    if (action === "find") {
      const name = args.name as string;
      if (!name) throw new Error("Nom requis");
      if (isWindows) return execSync(`tasklist /FI "IMAGENAME eq *${name}*" /FO CSV /NH`, { encoding: "utf-8" });
      return execSync(`pgrep -la "${name}" || echo "Aucun processus trouvé"`, { encoding: "utf-8" });
    }
    return "Action inconnue";
  }
}
