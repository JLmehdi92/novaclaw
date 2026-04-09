import { BaseSkill, SkillContext } from "../base.js";
import Database from "better-sqlite3";
import path from "path";

export class DatabaseSkill extends BaseSkill {
  name = "database";
  description = "Exécuter des requêtes SQL (SQLite)";
  category = "code";
  parameters = {
    type: "object" as const,
    properties: {
      database: { type: "string", description: "Chemin de la base SQLite" },
      query: { type: "string", description: "Requête SQL" },
      action: { type: "string", enum: ["query", "tables", "schema"], description: "Type d'action" },
    },
    required: ["database", "action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const dbPath = path.resolve(context.workspace, args.database as string);
    if (!dbPath.startsWith(path.resolve(context.workspace))) throw new Error("Path traversal not allowed");

    const db = new Database(dbPath);
    const action = args.action as string;

    try {
      if (action === "tables") {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
        return tables.map(t => t.name).join("\n") || "Aucune table";
      }
      if (action === "schema") {
        const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all() as any[];
        return tables.map(t => `-- ${t.name}\n${t.sql}`).join("\n\n");
      }
      if (action === "query") {
        const query = args.query as string;
        if (!query) throw new Error("Query requise");
        if (query.trim().toUpperCase().startsWith("SELECT")) {
          const rows = db.prepare(query).all();
          return JSON.stringify(rows, null, 2);
        }
        const result = db.prepare(query).run();
        return `Rows affected: ${result.changes}`;
      }
    } finally {
      db.close();
    }
    return "Action non supportée";
  }
}
