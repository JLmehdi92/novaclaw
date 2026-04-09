// src/gateway/commands/telegram-commands.ts
import { Bot, Context } from "grammy";
import { novaClawAgent } from "../../core/agent.js";
import { ClaudeClient } from "../../claude/client.js";
import { SkillsRegistry } from "../../skills/registry.js";
import { authManager } from "../../security/auth.js";
import { CLAUDE_MODELS, getModelId } from "../../claude/models.js";
import { loadConfig } from "../../config.js";

export function registerCommands(bot: Bot<Context>): void {
  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name || "utilisateur";
    await ctx.reply(
      `👋 Salut ${name} ! Je suis **NovaClaw**, ton assistant IA personnel.

🛠 Je peux :
• Naviguer sur le web et faire des recherches
• Exécuter du code (JavaScript, Python)
• Manipuler des fichiers
• Appeler des APIs
• Exécuter des commandes shell

📝 Commandes disponibles :
/status - Mon état actuel
/skills - Liste mes capacités
/model - Changer de modèle Claude
/reset - Nouvelle conversation

Dis-moi ce que tu veux faire !`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("status", async (ctx) => {
    const model = ClaudeClient.getModel();
    const skillCount = SkillsRegistry.count();
    const config = loadConfig();

    await ctx.reply(
      `📊 **Status NovaClaw**

🤖 Modèle: ${model}
🛠 Skills actifs: ${skillCount}
🌐 Langue: ${config.language}
✅ Status: En ligne`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("skills", async (ctx) => {
    const skills = SkillsRegistry.getNames();
    const list = skills.map((s) => `• ${s}`).join("\n");

    await ctx.reply(
      `🛠 **Skills disponibles (${skills.length})**

${list}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("model", async (ctx) => {
    const arg = ctx.message?.text?.split(" ")[1]?.toLowerCase();

    if (!arg) {
      const current = ClaudeClient.getModel();
      const models = Object.entries(CLAUDE_MODELS)
        .map(([key, m]) => `• \`${key}\` - ${m.name}`)
        .join("\n");

      await ctx.reply(
        `🧠 **Modèle actuel**: ${current}

**Modèles disponibles**:
${models}

Usage: \`/model opus-4.6\``,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const modelId = getModelId(arg);
    ClaudeClient.setModel(modelId);
    await ctx.reply(`✅ Modèle changé: ${modelId}`);
  });

  bot.command("reset", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (chatId) {
      await novaClawAgent.resetSession(chatId);
      await ctx.reply("🔄 Conversation réinitialisée !");
    }
  });
}
