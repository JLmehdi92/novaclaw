import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";

export class GitSkill extends BaseSkill {
  name = "git";
  description = "Opérations Git (status, log, diff, commit, etc.)";
  category = "code";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["status", "log", "diff", "add", "commit", "push", "pull", "branch", "checkout"], description: "Action Git" },
      args: { type: "string", description: "Arguments supplémentaires" },
      message: { type: "string", description: "Message de commit" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const extraArgs = (args.args as string) || "";
    const message = args.message as string;

    const cmds: Record<string, string> = {
      status: "git status -s",
      log: "git log --oneline -10",
      diff: `git diff ${extraArgs}`.trim(),
      add: `git add ${extraArgs || "."}`,
      commit: message ? `git commit -m "${message}"` : "echo 'Message requis'",
      push: "git push",
      pull: "git pull",
      branch: `git branch ${extraArgs}`.trim(),
      checkout: `git checkout ${extraArgs}`,
    };

    const cmd = cmds[action];
    if (!cmd) return "Action non supportée";
    try {
      return execSync(cmd, { encoding: "utf-8", cwd: context.workspace, timeout: 60000 }).trim() || "OK";
    } catch (error: any) {
      return `Erreur Git: ${error.message}`;
    }
  }
}
