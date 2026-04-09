import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";
import os from "os";

export class ServiceManagerSkill extends BaseSkill {
  name = "service-manager";
  description = "Gérer les services système";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["start", "stop", "restart", "status", "list"], description: "Action" },
      name: { type: "string", description: "Nom du service" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const name = args.name as string;
    const isWindows = os.platform() === "win32";

    if (action === "list") {
      if (isWindows) return execSync("sc query type= service state= all | findstr SERVICE_NAME", { encoding: "utf-8" });
      return execSync("systemctl list-units --type=service --state=running --no-pager | head -30", { encoding: "utf-8" });
    }
    if (!name) throw new Error("Nom du service requis");
    const cmds: Record<string, { win: string; linux: string }> = {
      start: { win: `sc start ${name}`, linux: `systemctl start ${name}` },
      stop: { win: `sc stop ${name}`, linux: `systemctl stop ${name}` },
      restart: { win: `sc stop ${name} && sc start ${name}`, linux: `systemctl restart ${name}` },
      status: { win: `sc query ${name}`, linux: `systemctl status ${name} --no-pager` },
    };
    try {
      return execSync(cmds[action][isWindows ? "win" : "linux"], { encoding: "utf-8" });
    } catch (error: any) {
      return `Erreur: ${error.message}`;
    }
  }
}
