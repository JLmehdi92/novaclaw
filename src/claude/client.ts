// src/claude/client.ts
import { loadConfig, loadCredentials } from "../config/loader.js";
import { getModelId, DEFAULT_MODEL } from "./models.js";
import { SkillsRegistry } from "../skills/registry.js";
import { logger } from "../utils/logger.js";
import { SkillError } from "../utils/errors.js";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatOptions {
  messages: Message[];
  systemPrompt: string;
  model?: string;
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<string>;
}

interface ChatResponse {
  text: string;
  toolsUsed: string[];
}

class ClaudeClientClass {
  private initialized = false;
  private model: string = DEFAULT_MODEL;

  async initialize(options?: { model?: string }): Promise<void> {
    const config = loadConfig();
    this.model = options?.model || config.provider.model || DEFAULT_MODEL;

    // Verify Claude CLI is available (use shell: true for PATH resolution on Windows)
    const versionCheck = spawnSync("claude", ["--version"], { encoding: "utf-8", shell: true });
    if (versionCheck.error || versionCheck.status !== 0) {
      throw new Error(
        "Claude CLI non trouvé. Installe-le avec: npm install -g @anthropic-ai/claude-code"
      );
    }
    logger.info(`Claude CLI detected: ${versionCheck.stdout.trim()}`);

    this.initialized = true;
    logger.info(`Claude client initialized with model: ${this.model} (via CLI)`);
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    if (!this.initialized) {
      throw new Error("Claude client not initialized");
    }

    const { messages, systemPrompt, onToolCall } = options;
    const model = getModelId(options.model || this.model);
    const tools = SkillsRegistry.getToolDefinitions();
    const toolsUsed: string[] = [];

    const conversationMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    logger.debug(`Sending to Claude (${model}): ${messages.length} messages, ${tools.length} tools`);

    // Placeholder response - will be replaced with actual SDK call
    const response = await this.callClaude({
      model,
      system: systemPrompt,
      messages: conversationMessages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    });

    if (response.toolCalls && onToolCall) {
      for (const toolCall of response.toolCalls) {
        toolsUsed.push(toolCall.name);
        const result = await onToolCall(toolCall.name, toolCall.input);
        logger.debug(`Tool ${toolCall.name} returned: ${result.slice(0, 100)}...`);
      }
    }

    return {
      text: response.text,
      toolsUsed,
    };
  }

  private async callClaude(request: {
    model: string;
    system: string;
    messages: Array<{ role: string; content: string }>;
    tools: Array<{ name: string; description: string; input_schema: unknown }>;
  }): Promise<{ text: string; toolCalls?: Array<{ name: string; input: Record<string, unknown> }> }> {
    // Get only the last user message (simple approach)
    const lastUserMessage = request.messages.filter((m) => m.role === "user").pop();
    const prompt = lastUserMessage?.content || "";

    // Use system prompt or fallback to default
    const systemPrompt = request.system?.trim() ||
      "Tu es NovaClaw, un assistant IA personnel. Réponds en français de manière utile et amicale.";

    // Write system prompt to a temp file to avoid shell escaping issues on Windows.
    // Without this, special characters (accents, quotes, &, |, etc.) in the system prompt
    // get mangled by cmd.exe when passed as a CLI argument with shell: true.
    const tmpFile = path.join(os.tmpdir(), `novaclaw-sysprompt-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, systemPrompt, "utf-8");

    try {
      logger.debug(`Calling Claude CLI with prompt: ${prompt.slice(0, 50)}...`);

      // FIX: Pass user prompt via stdin (input option) instead of as a CLI argument.
      // With shell: true, CLI arguments go through cmd.exe on Windows, which interprets
      // special characters (', ", &, |, ^, %, !, etc.) and mangles or truncates the prompt.
      // This caused Claude to receive empty/garbled prompts and respond with
      // "It looks like your message got cut off."
      // stdin (the input option) bypasses the shell entirely — data goes through a pipe.
      const result = spawnSync("claude", [
        "-p",
        "--no-session-persistence",
        "--system-prompt-file", tmpFile,
        "--model", request.model,
        "--output-format", "text"
      ], {
        input: prompt,
        encoding: "utf-8",
        timeout: 180000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        shell: true,
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        logger.error(`Claude CLI stderr: ${result.stderr}`);
        throw new Error(`Claude CLI exited with code ${result.status}`);
      }

      return {
        text: result.stdout.trim() || "Je n'ai pas pu générer de réponse.",
        toolCalls: undefined,
      };
    } catch (error: any) {
      logger.error(`Claude CLI error: ${error.message}`);
      throw new Error(`Claude CLI error: ${error.message}`);
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
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
