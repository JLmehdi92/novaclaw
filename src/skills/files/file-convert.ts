import { BaseSkill, SkillContext } from "../base.js";
import fs from "fs";
import path from "path";

export class FileConvertSkill extends BaseSkill {
  name = "file-convert";
  description = "Convertir des formats de fichiers";
  category = "files";
  parameters = {
    type: "object" as const,
    properties: {
      input: { type: "string", description: "Fichier source" },
      output: { type: "string", description: "Fichier destination" },
      format: { type: "string", enum: ["json-to-csv", "csv-to-json", "json-to-yaml", "yaml-to-json"], description: "Type de conversion" },
    },
    required: ["input", "output", "format"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const inputPath = path.resolve(context.workspace, args.input as string);
    const outputPath = path.resolve(context.workspace, args.output as string);
    if (!inputPath.startsWith(path.resolve(context.workspace))) throw new Error("Path traversal not allowed");

    const content = fs.readFileSync(inputPath, "utf-8");
    const format = args.format as string;
    let result = "";

    if (format === "json-to-csv") {
      const data = JSON.parse(content);
      if (!Array.isArray(data)) throw new Error("JSON doit être un tableau");
      const headers = Object.keys(data[0] || {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = [headers.join(","), ...data.map((row: any) => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
    } else if (format === "csv-to-json") {
      const lines = content.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const rows = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      });
      result = JSON.stringify(rows, null, 2);
    } else {
      return `Conversion ${format} non implémentée`;
    }

    fs.writeFileSync(outputPath, result);
    return `Converti: ${path.basename(inputPath)} → ${path.basename(outputPath)}`;
  }
}
