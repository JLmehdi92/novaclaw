import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";

export class PackageManagerSkill extends BaseSkill {
  name = "package-manager";
  description = "Gérer les packages (npm, pip)";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      manager: { type: "string", enum: ["npm", "pip"], description: "Package manager" },
      action: { type: "string", enum: ["install", "uninstall", "list", "update"], description: "Action" },
      package: { type: "string", description: "Nom du package" },
      global: { type: "boolean", description: "Global (npm)" },
    },
    required: ["manager", "action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const manager = args.manager as string;
    const action = args.action as string;
    const pkg = args.package as string || "";
    const global = args.global as boolean;

    const cmds: Record<string, Record<string, string>> = {
      npm: { install: `npm install ${global ? "-g " : ""}${pkg}`, uninstall: `npm uninstall ${global ? "-g " : ""}${pkg}`, list: `npm list ${global ? "-g " : ""}--depth=0`, update: `npm update` },
      pip: { install: `pip install ${pkg}`, uninstall: `pip uninstall -y ${pkg}`, list: "pip list", update: `pip install --upgrade ${pkg}` },
    };

    const cmd = cmds[manager]?.[action];
    if (!cmd) return `Combinaison non supportée: ${manager} ${action}`;
    try {
      return execSync(cmd, { encoding: "utf-8", cwd: context.workspace, timeout: 120000 });
    } catch (error: any) {
      return `Erreur: ${error.message}`;
    }
  }
}
