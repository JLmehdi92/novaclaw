// src/claude/client.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadConfig } from "../config/loader.js";
import { getModelId, DEFAULT_MODEL } from "./models.js";
import { logger } from "../utils/logger.js";
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

class ClaudeClientClass {
  private initialized = false;
  private model: string = DEFAULT_MODEL;

  async initialize(options?: { model?: string }): Promise<void> {
    const config = loadConfig();
    this.model = options?.model || config.provider.model || DEFAULT_MODEL;
    this.initialized = true;
    logger.info(`Claude client initialized with model: ${this.model} (via Agent SDK)`);
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

    // Resume existing session for multi-turn conversations
    const existingSessionId = chatId ? chatSessions.get(chatId) : undefined;

    logger.debug(`Sending to Claude SDK (${model}): "${prompt.slice(0, 50)}..." session=${existingSessionId || "new"}`);

    try {
      const resultText = await this.callClaude(prompt, {
        model,
        systemPrompt,
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
            systemPrompt,
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
      systemPrompt: string;
      sessionId?: string;
      chatId?: number;
      toolsUsed: string[];
    }
  ): Promise<string> {
    const queryOptions: Record<string, unknown> = {
      cwd: os.homedir(),
      model: opts.model,
      // Use preset mode: keeps the full Claude Code system prompt (with tool instructions)
      // and APPENDS our NovaClaw identity. A plain string would REPLACE everything,
      // causing Claude to lose knowledge of its tools (Bash, Read, Write, Edit, etc.).
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: opts.systemPrompt,
      },
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
      // Final result message — contains the complete response
      if (message.type === "result") {
        sessionId = message.session_id;
        if (message.subtype === "success") {
          resultText = message.result;
        } else {
          throw new Error(`Claude error: ${(message as any).error || "unknown"}`);
        }
      }

      // Track tool usage from assistant messages
      if (message.type === "assistant" && message.message?.content) {
        sessionId = message.session_id;
        for (const block of message.message.content as any[]) {
          if (block.type === "tool_use") {
            opts.toolsUsed.push(block.name);
          }
        }
      }
    }

    // Store session for multi-turn conversations
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
