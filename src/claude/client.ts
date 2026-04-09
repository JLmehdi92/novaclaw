// src/claude/client.ts
import { loadConfig } from "../config/loader.js";
import { getModelId, DEFAULT_MODEL } from "./models.js";
import { SkillsRegistry } from "../skills/registry.js";
import { logger } from "../utils/logger.js";
import { SkillError } from "../utils/errors.js";

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

  async initialize(options?: { model?: string; apiKey?: string }): Promise<void> {
    const config = loadConfig();
    this.model = options?.model || config.provider.model || DEFAULT_MODEL;
    this.initialized = true;
    logger.info(`Claude client initialized with model: ${this.model}`);
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
    // TODO: Replace with actual Claude Agent SDK call
    const lastUserMessage = request.messages.filter((m) => m.role === "user").pop();

    return {
      text: `[NovaClaw MVP] Je suis en mode test. Tu as dit: "${lastUserMessage?.content || ""}"

Modèle configuré: ${request.model}
Tools disponibles: ${request.tools.map((t) => t.name).join(", ")}

Pour activer les vraies réponses Claude, intègre le Claude Agent SDK.`,
      toolCalls: undefined,
    };
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
