import { BaseSkill, SkillContext } from "../base.js";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export class ArchiveSkill extends BaseSkill {
  name = "archive";
  description = "Créer ou extraire des archives (ZIP, TAR)";
  category = "files";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["create", "extract", "list"], description: "Action" },
      archive: { type: "string", description: "Chemin de l'archive" },
      files: { type: "array", items: { type: "string" }, description: "Fichiers à archiver" },
      destination: { type: "string", description: "Destination extraction" },
    },
    required: ["action", "archive"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const archive = path.resolve(context.workspace, args.archive as string);
    if (!archive.startsWith(path.resolve(context.workspace))) throw new Error("Path traversal not allowed");

    const isZip = archive.endsWith(".zip");
    const isTar = archive.endsWith(".tar.gz") || archive.endsWith(".tgz") || archive.endsWith(".tar");

    if (action === "create") {
      const files = (args.files as string[]) || [];
      if (files.length === 0) throw new Error("Fichiers requis");
      if (isZip) {
        execSync(`zip -r "${archive}" ${files.join(" ")}`, { cwd: context.workspace });
      } else if (isTar) {
        execSync(`tar -czf "${archive}" ${files.join(" ")}`, { cwd: context.workspace });
      }
      return `Archive créée: ${path.basename(archive)}`;
    }
    if (action === "extract") {
      const dest = args.destination ? path.resolve(context.workspace, args.destination as string) : context.workspace;
      fs.mkdirSync(dest, { recursive: true });
      if (isZip) execSync(`unzip -o "${archive}" -d "${dest}"`);
      else if (isTar) execSync(`tar -xzf "${archive}" -C "${dest}"`);
      return `Archive extraite dans: ${path.relative(context.workspace, dest) || "."}`;
    }
    if (action === "list") {
      if (isZip) return execSync(`unzip -l "${archive}"`, { encoding: "utf-8" });
      if (isTar) return execSync(`tar -tzf "${archive}"`, { encoding: "utf-8" });
    }
    return "Format non supporté (utilisez .zip ou .tar.gz)";
  }
}
