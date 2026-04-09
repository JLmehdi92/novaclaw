import { BaseSkill, SkillContext } from "../base.js";
import fs from "fs";
import path from "path";

export class FileSearchSkill extends BaseSkill {
  name = "file-search";
  description = "Rechercher des fichiers par nom ou contenu";
  category = "files";
  parameters = {
    type: "object" as const,
    properties: {
      pattern: { type: "string", description: "Pattern de recherche (glob ou texte)" },
      searchContent: { type: "boolean", description: "Rechercher dans le contenu" },
      directory: { type: "string", description: "Répertoire de départ" },
      maxResults: { type: "number", description: "Nombre max de résultats" },
    },
    required: ["pattern"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const pattern = (args.pattern as string).toLowerCase();
    const searchContent = args.searchContent as boolean;
    const directory = args.directory as string || ".";
    const maxResults = (args.maxResults as number) || 20;
    const basePath = path.resolve(context.workspace, directory);
    if (!basePath.startsWith(path.resolve(context.workspace))) throw new Error("Path traversal not allowed");

    const results: string[] = [];
    const search = (dir: string, depth: number) => {
      if (depth > 5 || results.length >= maxResults) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (results.length >= maxResults) return;
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(context.workspace, fullPath);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith(".") && entry.name !== "node_modules") search(fullPath, depth + 1);
          } else if (entry.name.toLowerCase().includes(pattern)) {
            results.push(relativePath);
          } else if (searchContent && entry.isFile()) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              if (content.toLowerCase().includes(pattern)) results.push(`${relativePath} (contenu)`);
            } catch {}
          }
        }
      } catch {}
    };
    search(basePath, 0);
    return results.length > 0 ? results.join("\n") : "Aucun fichier trouvé";
  }
}
