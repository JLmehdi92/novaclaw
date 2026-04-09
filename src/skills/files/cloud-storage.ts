import { BaseSkill, SkillContext } from "../base.js";

export class CloudStorageSkill extends BaseSkill {
  name = "cloud-storage";
  description = "Gérer le stockage cloud (Google Drive, S3, Dropbox)";
  category = "files";
  parameters = {
    type: "object" as const,
    properties: {
      provider: { type: "string", enum: ["gdrive", "s3", "dropbox"], description: "Fournisseur cloud" },
      action: { type: "string", enum: ["upload", "download", "list"], description: "Action" },
      path: { type: "string", description: "Chemin local ou distant" },
    },
    required: ["provider", "action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    return "Cloud storage non configuré. Configurer les credentials via novaclaw config set skills.config.cloud-storage.{provider}";
  }
}
