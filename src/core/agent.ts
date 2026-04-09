// src/core/agent.ts
import { ClaudeClient } from "../claude/client.js";
import { SkillsRegistry } from "../skills/registry.js";
import { sessionManager } from "./session.js";
import { memoryManager } from "./memory.js";
import { authManager } from "../security/auth.js";
import { logger } from "../utils/logger.js";
import { loadConfig, getConfigDir } from "../config/loader.js";
import { PERSONALITY_PROMPTS } from "../config/defaults.js";
import path from "path";
import fs from "fs";

export const novaClawAgent = {
  async handleMessage(
    chatId: number,
    userId: number,
    text: string
  ): Promise<string> {
    const config = loadConfig();
    const workspace = this.ensureWorkspace(userId);
    const session = sessionManager.getOrCreate(chatId, userId);
    const context = await memoryManager.buildContext(chatId, userId);

    await memoryManager.appendMessage(chatId, userId, "user", text);

    const systemPrompt = this.buildSystemPrompt(userId, context.memories);

    try {
      const response = await ClaudeClient.chat({
        messages: [
          ...context.messages,
          { role: "user", content: text },
        ],
        systemPrompt,
        onToolCall: async (toolName, args) => {
          return this.executeSkill(toolName, args, { userId, chatId, workspace });
        },
      });

      await memoryManager.appendMessage(chatId, userId, "assistant", response.text);

      if (response.toolsUsed.length > 0) {
        authManager.logAction(userId, "skills_used", { skills: response.toolsUsed });
      }

      return response.text;
    } catch (error) {
      logger.error(`Agent error: ${error}`);
      return `Erreur: ${error instanceof Error ? error.message : String(error)}`;
    }
  },

  async executeSkill(
    toolName: string,
    args: Record<string, unknown>,
    context: { userId: number; chatId: number; workspace: string }
  ): Promise<string> {
    const skill = SkillsRegistry.get(toolName);
    if (!skill) {
      return `Skill inconnu: ${toolName}`;
    }

    try {
      authManager.logAction(context.userId, "skill_executed", { skill: toolName, args });
      return await skill.execute(args, context);
    } catch (error) {
      logger.error(`Skill ${toolName} error: ${error}`);
      return `Erreur skill ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  },

  buildSystemPrompt(userId: number, memories: Array<{ key: string; value: string }>): string {
    const config = loadConfig();
    const lang = config.agent.language === "fr" ? "français" : "English";

    // Use custom prompt if set, otherwise use personality preset
    let basePrompt = config.agent.customSystemPrompt
      || PERSONALITY_PROMPTS[config.agent.personality]
      || PERSONALITY_PROMPTS.assistant;

    let prompt = `${basePrompt}
Réponds en ${lang}. L'utilisateur actuel a l'ID Telegram ${userId}.`;

    if (memories.length > 0) {
      prompt += "\n\nMémoires de l'utilisateur:";
      for (const mem of memories) {
        prompt += `\n- ${mem.key}: ${mem.value}`;
      }
    }

    return prompt;
  },

  ensureWorkspace(userId: number): string {
    const workspacesDir = path.join(getConfigDir(), "workspaces");
    const workspace = path.join(workspacesDir, String(userId));
    if (!fs.existsSync(workspace)) {
      fs.mkdirSync(workspace, { recursive: true });
    }
    return workspace;
  },

  async resetSession(chatId: number): Promise<void> {
    sessionManager.reset(chatId);
    await memoryManager.clearChat(chatId);
    logger.info(`Session reset for chat ${chatId}`);
  },
};
