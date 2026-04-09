// src/claude/client.ts
import { loadConfig, loadCredentials } from "../config/loader.js";
import { getModelId, DEFAULT_MODEL } from "./models.js";
import { SkillsRegistry } from "../skills/registry.js";
import { logger } from "../utils/logger.js";
import { SkillError } from "../utils/errors.js";
import { execSync } from "child_process";

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

    // Verify Claude CLI is available
    try {
      execSync("claude --version", { stdio: "pipe" });
      logger.info("Claude CLI detected");
    } catch {
      throw new Error(
        "Claude CLI non trouvé. Installe-le avec: npm install -g @anthropic-ai/claude-code"
      );
    }

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
    // Build the prompt from messages
    const lastUserMessage = request.messages.filter((m) => m.role === "user").pop();
    const prompt = lastUserMessage?.content || "";

    // Build conversation context
    const context = request.messages
      .slice(0, -1) // Exclude the last message (we'll send it as the prompt)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const fullPrompt = context ? `${context}\n\nUser: ${prompt}` : prompt;

    try {
      // Call Claude CLI with -p (print mode) and --output-format text
      const escapedPrompt = fullPrompt.replace(/"/g, '\\"').replace(/\n/g, "\\n");
      const escapedSystem = request.system.replace(/"/g, '\\"').replace(/\n/g, "\\n");

      const cmd = `claude -p "${escapedPrompt}" --model ${request.model} --system-prompt "${escapedSystem}" --output-format text --bare`;

      logger.debug(`Calling Claude CLI: ${cmd.slice(0, 100)}...`);

      const output = execSync(cmd, {
        encoding: "utf-8",
        timeout: 120000, // 2 minutes timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        text: output.trim() || "Je n'ai pas pu générer de réponse.",
        toolCalls: undefined, // CLI mode doesn't support tool calls for now
      };
    } catch (error: any) {
      logger.error(`Claude CLI error: ${error.message}`);
      if (error.stderr) {
        logger.error(`stderr: ${error.stderr}`);
      }
      throw new Error(`Claude CLI error: ${error.message}`);
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
