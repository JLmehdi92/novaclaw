import { BaseSkill, SkillContext } from "../base.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export class FileWatchSkill extends BaseSkill {
  name = "file-watch";
  description = "Surveiller des fichiers/dossiers pour changements";
  category = "files";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["snapshot", "check"], description: "Action" },
      path: { type: "string", description: "Chemin à surveiller" },
      name: { type: "string", description: "Nom du watch" },
    },
    required: ["action", "path"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const targetPath = path.resolve(context.workspace, args.path as string);
    const name = (args.name as string) || crypto.createHash("md5").update(targetPath).digest("hex").slice(0, 8);
    const snapshotFile = path.join(context.workspace, ".file-watch", `${name}.json`);
    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });

    const getSnapshot = (p: string): Record<string, string> => {
      const result: Record<string, string> = {};
      const stat = fs.statSync(p);
      if (stat.isFile()) {
        result[p] = crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex");
      } else if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(p)) {
          if (entry.startsWith(".")) continue;
          Object.assign(result, getSnapshot(path.join(p, entry)));
        }
      }
      return result;
    };

    const current = getSnapshot(targetPath);

    if (action === "snapshot") {
      fs.writeFileSync(snapshotFile, JSON.stringify(current, null, 2));
      return `Snapshot créé: ${name} (${Object.keys(current).length} fichiers)`;
    }

    if (!fs.existsSync(snapshotFile)) {
      fs.writeFileSync(snapshotFile, JSON.stringify(current, null, 2));
      return `Premier snapshot créé pour ${name}`;
    }

    const previous = JSON.parse(fs.readFileSync(snapshotFile, "utf-8"));
    const changes: string[] = [];
    for (const [file, hash] of Object.entries(current)) {
      if (!previous[file]) changes.push(`+ ${path.relative(context.workspace, file)}`);
      else if (previous[file] !== hash) changes.push(`~ ${path.relative(context.workspace, file)}`);
    }
    for (const file of Object.keys(previous)) {
      if (!current[file]) changes.push(`- ${path.relative(context.workspace, file)}`);
    }

    fs.writeFileSync(snapshotFile, JSON.stringify(current, null, 2));
    return changes.length > 0 ? `Changements détectés:\n${changes.join("\n")}` : "Aucun changement";
  }
}
