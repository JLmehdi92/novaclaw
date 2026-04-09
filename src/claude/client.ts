// src/claude/client.ts
import { loadConfig, loadCredentials } from "../config/loader.js";
import { getModelId, DEFAULT_MODEL } from "./models.js";
import { SkillsRegistry } from "../skills/registry.js";
import { logger } from "../utils/logger.js";
import { SkillError } from "../utils/errors.js";
import { getAccessToken } from "../auth/claude-code.js";

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
  private authMethod: "oauth" | "apikey" = "apikey";
  private apiKey: string | null = null;
  private oauthToken: string | null = null;

  async initialize(options?: { model?: string; apiKey?: string }): Promise<void> {
    const config = loadConfig();
    const credentials = loadCredentials();

    this.model = options?.model || config.provider.model || DEFAULT_MODEL;
    this.authMethod = credentials.anthropic.authMethod;

    if (this.authMethod === "oauth") {
      // Always prefer fresh token from Claude Code over stored one
      this.oauthToken = getAccessToken() || credentials.anthropic.oauthToken;
      if (this.oauthToken) {
        logger.info(`Claude client using OAuth (${credentials.anthropic.oauthEmail || "unknown"})`);
      } else {
        logger.warn("OAuth token not available, falling back to API key");
        this.authMethod = "apikey";
      }
    }

    if (this.authMethod === "apikey") {
      this.apiKey = options?.apiKey || credentials.anthropic.apiKey;
    }

    // Verify we have some form of authentication
    if (!this.oauthToken && !this.apiKey) {
      throw new Error(
        "Aucune méthode d'authentification disponible. " +
        "Configure une API Key ou connecte-toi via 'claude login', puis relance 'novaclaw setup'."
      );
    }

    this.initialized = true;
    logger.info(`Claude client initialized with model: ${this.model} (auth: ${this.authMethod})`);
  }

  /**
   * Get the authorization header for API calls
   * Note: OAuth tokens must be sent via x-api-key header, NOT Bearer!
   */
  private getAuthHeader(): Record<string, string> {
    if (this.authMethod === "oauth" && this.oauthToken) {
      // OAuth tokens go via x-api-key, not Authorization Bearer
      return { "x-api-key": this.oauthToken };
    }
    if (this.apiKey) {
      return { "x-api-key": this.apiKey };
    }
    throw new Error(
      "Aucune authentification configurée. Exécute 'novaclaw setup' pour configurer."
    );
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
    const authHeaders = this.getAuthHeader();

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: 4096,
      system: request.system,
      messages: request.messages.filter(m => m.role !== "system"),
    };

    // Only include tools if there are any
    if (request.tools.length > 0) {
      body.tools = request.tools;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...authHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`Claude API error: ${response.status} - ${error}`);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
    };

    // Extract text and tool calls from response
    let text = "";
    const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];

    for (const block of data.content) {
      if (block.type === "text" && block.text) {
        text += block.text;
      } else if (block.type === "tool_use" && block.name && block.input) {
        toolCalls.push({ name: block.name, input: block.input });
      }
    }

    return {
      text: text || "Je n'ai pas pu générer de réponse.",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
