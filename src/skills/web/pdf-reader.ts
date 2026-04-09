// src/skills/web/pdf-reader.ts
import { BaseSkill, SkillContext } from "../base.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export class PdfReaderSkill extends BaseSkill {
  name = "pdf-reader";
  description = "Lire et extraire le texte d'un fichier PDF";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "Chemin du fichier PDF" },
      pages: { type: "string", description: "Pages à extraire (ex: 1-5)" },
    },
    required: ["path"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const pdfPath = args.path as string;
    const fullPath = path.resolve(context.workspace, pdfPath);
    if (!fullPath.startsWith(path.resolve(context.workspace))) {
      throw new Error("Path traversal not allowed");
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`PDF not found: ${pdfPath}`);
    }
    try {
      const text = execSync(`pdftotext -layout "${fullPath}" -`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      return text.slice(0, 50000);
    } catch {
      const stats = fs.statSync(fullPath);
      return `PDF: ${pdfPath}\nTaille: ${(stats.size / 1024).toFixed(1)} KB\n[pdftotext non disponible]`;
    }
  }
}
