import { BaseSkill, SkillContext } from "../base.js";
import fs from "fs";
import path from "path";

export class CodeAnalyzerSkill extends BaseSkill {
  name = "code-analyzer";
  description = "Analyser la qualité et complexité du code";
  category = "code";
  parameters = {
    type: "object" as const,
    properties: {
      file: { type: "string", description: "Fichier à analyser" },
      type: { type: "string", enum: ["complexity", "stats", "todos"], description: "Type d'analyse" },
    },
    required: ["file", "type"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const filePath = path.resolve(context.workspace, args.file as string);
    if (!filePath.startsWith(path.resolve(context.workspace))) throw new Error("Path traversal not allowed");
    if (!fs.existsSync(filePath)) throw new Error("Fichier non trouvé");

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const type = args.type as string;

    if (type === "stats") {
      const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("#"));
      const commentLines = lines.filter(l => l.trim().startsWith("//") || l.trim().startsWith("#"));
      return `Fichier: ${path.basename(filePath)}\nLignes totales: ${lines.length}\nLignes de code: ${codeLines.length}\nCommentaires: ${commentLines.length}\nLignes vides: ${lines.length - codeLines.length - commentLines.length}`;
    }
    if (type === "todos") {
      const todos = lines.map((l, i) => ({ line: i + 1, text: l })).filter(({ text }) => /TODO|FIXME|HACK|XXX/i.test(text));
      return todos.length > 0 ? todos.map(t => `L${t.line}: ${t.text.trim()}`).join("\n") : "Aucun TODO trouvé";
    }
    if (type === "complexity") {
      const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(|=>\s*{/g) || []).length;
      const conditions = (content.match(/if\s*\(|else|switch|case|\?\s*:/g) || []).length;
      const loops = (content.match(/for\s*\(|while\s*\(|\.forEach|\.map|\.filter|\.reduce/g) || []).length;
      return `Complexité:\nFonctions: ~${functions}\nConditions: ${conditions}\nBoucles/Iterations: ${loops}\nScore estimé: ${functions + conditions + loops}`;
    }
    return "Type d'analyse non supporté";
  }
}
