// src/claude/client.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadConfig } from "../config/loader.js";
import { getModelId, DEFAULT_MODEL } from "./models.js";
import { logger } from "../utils/logger.js";
import { getConfigDir } from "../config/loader.js";
import fs from "fs";
import path from "path";
import os from "os";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  messages: Message[];
  systemPrompt: string;
  model?: string;
  chatId?: number;
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<string>;
}

export interface ChatResponse {
  text: string;
  toolsUsed: string[];
}

// Session IDs per chat for multi-turn conversations
const chatSessions = new Map<number, string>();

/**
 * Create the NovaClaw agent workspace with CLAUDE.md (identity) and
 * .claude/settings.json (permissions). This is how OpenClaw, ZeroClaw, etc.
 * do it — a dedicated workspace directory that Claude Code reads automatically.
 * No need to touch the user's global ~/.claude/settings.json.
 */
function ensureWorkspace(): string {
  const workspace = path.join(getConfigDir(), "workspace");
  const claudeDir = path.join(workspace, ".claude");
  const skillsDir = path.join(workspace, "skills");

  // Create workspace structure
  for (const dir of [claudeDir, skillsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // .claude/settings.json — project-level permissions (not global)
  const settingsPath = path.join(claudeDir, "settings.json");
  const settings = {
    permissions: {
      allow: [
        "Bash(*)",
        "Read(*)",
        "Write(*)",
        "Edit(*)",
        "Glob(*)",
        "Grep(*)",
        "WebSearch(*)",
        "WebFetch(*)",
      ],
      defaultMode: "bypassPermissions",
    },
    allowDangerouslySkipPermissions: true,
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");

  // Copy workspace files (CLAUDE.md, SOUL.md, MEMORY.md, skills/) from the
  // bundled workspace/ directory in the project root to the runtime workspace.
  // Only overwrite CLAUDE.md, SOUL.md, and skills on each start (they may be
  // updated). MEMORY.md is only created if it doesn't exist (preserve user data).
  const bundledWorkspace = path.join(path.dirname(path.dirname(__dirname)), "workspace");
  if (fs.existsSync(bundledWorkspace)) {
    // Always overwrite these (may have updates from new versions)
    for (const file of ["CLAUDE.md", "SOUL.md", "IDENTITY.md"]) {
      const src = path.join(bundledWorkspace, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(workspace, file));
      }
    }
    // Only create if missing (preserve user-edited data)
    for (const file of ["MEMORY.md", "USER.md", "TOOLS.md", "BOOTSTRAP.md"]) {
      const src = path.join(bundledWorkspace, file);
      const dst = path.join(workspace, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }
    // Ensure memory/ directory exists for daily notes
    const memoryDir = path.join(workspace, "memory");
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    // Copy all skills (always overwrite)
    const bundledSkills = path.join(bundledWorkspace, "skills");
    if (fs.existsSync(bundledSkills)) {
      for (const file of fs.readdirSync(bundledSkills)) {
        fs.copyFileSync(path.join(bundledSkills, file), path.join(skillsDir, file));
      }
    }
  }

  return workspace;
}

class ClaudeClientClass {
  private initialized = false;
  private model: string = DEFAULT_MODEL;
  private workspace: string = "";

  async initialize(options?: { model?: string }): Promise<void> {
    const config = loadConfig();
    this.model = options?.model || config.provider.model || DEFAULT_MODEL;
    this.workspace = ensureWorkspace();
    this.initialized = true;
    logger.info(`Claude client initialized with model: ${this.model} (via Agent SDK)`);
    logger.info(`Agent workspace: ${this.workspace}`);
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    if (!this.initialized) {
      throw new Error("Claude client not initialized");
    }

    const { messages, systemPrompt, chatId } = options;
    const model = getModelId(options.model || this.model);
    const toolsUsed: string[] = [];

    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const prompt = lastUserMessage?.content || "";

    const existingSessionId = chatId ? chatSessions.get(chatId) : undefined;

    logger.debug(`Sending to Claude SDK (${model}): "${prompt.slice(0, 50)}..." session=${existingSessionId || "new"}`);

    try {
      const resultText = await this.callClaude(prompt, {
        model,
        sessionId: existingSessionId,
        chatId,
        toolsUsed,
      });

      return {
        text: resultText || "Je n'ai pas pu générer de réponse.",
        toolsUsed,
      };
    } catch (error: any) {
      // If resume failed, retry with a fresh session
      if (existingSessionId && chatId) {
        logger.warn(`Session resume failed, retrying fresh: ${error.message}`);
        chatSessions.delete(chatId);
        try {
          const resultText = await this.callClaude(prompt, {
            model,
            sessionId: undefined,
            chatId,
            toolsUsed,
          });
          return {
            text: resultText || "Je n'ai pas pu générer de réponse.",
            toolsUsed,
          };
        } catch (retryError: any) {
          logger.error(`Claude SDK retry error: ${retryError.message}`);
          throw retryError;
        }
      }
      logger.error(`Claude SDK error: ${error.message}`);
      throw error;
    }
  }

  private async callClaude(
    prompt: string,
    opts: {
      model: string;
      sessionId?: string;
      chatId?: number;
      toolsUsed: string[];
    }
  ): Promise<string> {
    const queryOptions: Record<string, unknown> = {
      // Workspace directory with CLAUDE.md (identity) and .claude/settings.json (permissions)
      cwd: this.workspace,
      model: opts.model,
      // Load project settings from the workspace's .claude/settings.json
      // This handles permissions WITHOUT touching the user's global ~/.claude/
      settingSources: ["project"],
      // Preset keeps all Claude Code tools + CLAUDE.md is read automatically for identity
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
      },
      // Programmatic bypass as fallback (belt + suspenders)
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
    };

    if (opts.sessionId) {
      queryOptions.resume = opts.sessionId;
    }

    let resultText = "";
    let sessionId = "";

    for await (const message of query({ prompt, options: queryOptions as any })) {
      if (message.type === "result") {
        sessionId = message.session_id;
        if (message.subtype === "success") {
          resultText = message.result;
        } else {
          throw new Error(`Claude error: ${(message as any).error || "unknown"}`);
        }
      }

      if (message.type === "assistant" && message.message?.content) {
        sessionId = message.session_id;
        for (const block of message.message.content as any[]) {
          if (block.type === "tool_use") {
            opts.toolsUsed.push(block.name);
          }
        }
      }
    }

    if (opts.chatId && sessionId) {
      chatSessions.set(opts.chatId, sessionId);
    }

    return resultText;
  }

  clearSession(chatId: number): void {
    chatSessions.delete(chatId);
    logger.info(`Session cleared for chat ${chatId}`);
  }

  setModel(model: string): void {
    this.model = model;
    logger.info(`Model changed to: ${model}`);
  }

  getModel(): string {
    return this.model;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const ClaudeClient = new ClaudeClientClass();
