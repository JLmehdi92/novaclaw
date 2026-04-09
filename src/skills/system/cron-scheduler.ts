import { BaseSkill, SkillContext } from "../base.js";
import { getDatabase } from "../../storage/db.js";

export class CronSchedulerSkill extends BaseSkill {
  name = "cron-scheduler";
  description = "Planifier des tâches récurrentes";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["create", "list", "delete", "enable", "disable"], description: "Action" },
      name: { type: "string", description: "Nom de la tâche" },
      cron: { type: "string", description: "Expression cron" },
      command: { type: "string", description: "Commande à exécuter" },
      taskId: { type: "number", description: "ID de la tâche" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const db = getDatabase();

    if (action === "list") {
      const tasks = db.prepare("SELECT id, name, cron_expression, action, enabled FROM scheduled_tasks WHERE user_id = ?").all(context.userId) as any[];
      if (tasks.length === 0) return "Aucune tâche planifiée";
      return tasks.map(t => `[${t.id}] ${t.name} (${t.enabled ? "actif" : "inactif"})\n    Cron: ${t.cron_expression}\n    Action: ${t.action}`).join("\n\n");
    }
    if (action === "create") {
      const { name, cron, command } = args as { name: string; cron: string; command: string };
      if (!name || !cron || !command) throw new Error("name, cron et command requis");
      db.prepare("INSERT INTO scheduled_tasks (user_id, chat_id, name, cron_expression, action, enabled) VALUES (?, ?, ?, ?, ?, 1)").run(context.userId, context.chatId, name, cron, command);
      return `Tâche créée: ${name}`;
    }
    if (action === "delete" || action === "enable" || action === "disable") {
      const taskId = args.taskId as number;
      if (!taskId) throw new Error("taskId requis");
      if (action === "delete") { db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(taskId); return `Tâche ${taskId} supprimée`; }
      db.prepare("UPDATE scheduled_tasks SET enabled = ? WHERE id = ?").run(action === "enable" ? 1 : 0, taskId);
      return `Tâche ${taskId} ${action === "enable" ? "activée" : "désactivée"}`;
    }
    return "Action inconnue";
  }
}
