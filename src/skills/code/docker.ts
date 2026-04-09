import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";

export class DockerSkill extends BaseSkill {
  name = "docker";
  description = "Gérer des containers Docker";
  category = "code";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["ps", "images", "run", "stop", "logs", "build"], description: "Action Docker" },
      container: { type: "string", description: "Nom ou ID du container" },
      image: { type: "string", description: "Image Docker" },
      args: { type: "string", description: "Arguments supplémentaires" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const container = args.container as string;
    const image = args.image as string;
    const extraArgs = (args.args as string) || "";

    const cmds: Record<string, string> = {
      ps: "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'",
      images: "docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'",
      run: image ? `docker run -d ${extraArgs} ${image}` : "echo 'Image requise'",
      stop: container ? `docker stop ${container}` : "echo 'Container requis'",
      logs: container ? `docker logs --tail 50 ${container}` : "echo 'Container requis'",
      build: `docker build ${extraArgs} .`,
    };

    try {
      return execSync(cmds[action] || "echo 'Action inconnue'", { encoding: "utf-8", cwd: context.workspace, timeout: 120000 }).trim();
    } catch (error: any) {
      return `Erreur Docker: ${error.message}`;
    }
  }
}
