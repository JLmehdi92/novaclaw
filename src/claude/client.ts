// src/claude/client.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadConfig } from "../config/loader.js";
import { getModelId, DEFAULT_MODEL } from "./models.js";
import { logger } from "../utils/logger.js";
import { getConfigDir } from "../config/loader.js";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/** Recursively copy a directory, creating subdirs as needed. */
function copyDirRecursive(src: string, dst: string): void {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

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
    // Copy all skills recursively (always overwrite)
    // Skills are directories (e.g., skills/github/SKILL.md), not flat files
    const bundledSkills = path.join(bundledWorkspace, "skills");
    if (fs.existsSync(bundledSkills)) {
      copyDirRecursive(bundledSkills, skillsDir);
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
    // Build system prompt from workspace files (like OpenClaw does)
    // We do NOT use preset: "claude_code" because it forces the identity
    // "You are Claude Code, Anthropic's official CLI" which we can't override.
    // Tools (Bash, Read, Write, Edit, etc.) are available regardless of system prompt.
    const systemPrompt = this.buildSystemPrompt();

    const queryOptions: Record<string, unknown> = {
      cwd: this.workspace,
      model: opts.model,
      settingSources: ["project"],
      systemPrompt,
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

  /**
   * Build the system prompt from workspace files, like OpenClaw does.
   * Does NOT use the Claude Code preset — builds a custom prompt so the
   * agent has its own identity (NovaClaw, not Claude Code).
   */
  private buildSystemPrompt(): string {
    const sections: string[] = [];

    // 1. Load SOUL.md (personality)
    const soulPath = path.join(this.workspace, "SOUL.md");
    if (fs.existsSync(soulPath)) {
      sections.push(fs.readFileSync(soulPath, "utf-8"));
    }

    // 2. Load IDENTITY.md
    const identityPath = path.join(this.workspace, "IDENTITY.md");
    if (fs.existsSync(identityPath)) {
      sections.push(fs.readFileSync(identityPath, "utf-8"));
    }

    // 3. Load CLAUDE.md (instructions)
    const claudePath = path.join(this.workspace, "CLAUDE.md");
    if (fs.existsSync(claudePath)) {
      sections.push(fs.readFileSync(claudePath, "utf-8"));
    }

    // 4. Load USER.md (owner info)
    const userPath = path.join(this.workspace, "USER.md");
    if (fs.existsSync(userPath)) {
      sections.push(fs.readFileSync(userPath, "utf-8"));
    }

    // 5. Load TOOLS.md (local tools)
    const toolsPath = path.join(this.workspace, "TOOLS.md");
    if (fs.existsSync(toolsPath)) {
      sections.push(fs.readFileSync(toolsPath, "utf-8"));
    }

    // 6. Load MEMORY.md (long-term memory)
    const memoryPath = path.join(this.workspace, "MEMORY.md");
    if (fs.existsSync(memoryPath)) {
      sections.push("# Memoire\n" + fs.readFileSync(memoryPath, "utf-8"));
    }

    // 7. Load today's daily notes
    const today = new Date().toISOString().split("T")[0];
    const dailyPath = path.join(this.workspace, "memory", `${today}.md`);
    if (fs.existsSync(dailyPath)) {
      sections.push("# Notes du jour\n" + fs.readFileSync(dailyPath, "utf-8"));
    }

    // 8. Load BOOTSTRAP.md (first run only)
    const bootstrapPath = path.join(this.workspace, "BOOTSTRAP.md");
    if (fs.existsSync(bootstrapPath)) {
      sections.push(fs.readFileSync(bootstrapPath, "utf-8"));
    }

    // 9. Tool usage instructions (critical — without this, tools may not be used)
    sections.push(`# Outils disponibles

Tu as acces a des outils pour agir sur la machine. UTILISE-LES. Ne fais pas semblant d'agir — appelle les vrais outils.

## Regles d'utilisation des outils
- Tu DOIS utiliser les outils pour toute action concrete (creer/lire/modifier des fichiers, executer des commandes, chercher)
- Ne dis JAMAIS "je vais creer le fichier" sans REELLEMENT appeler l'outil Write/Edit
- Ne dis JAMAIS "je vais executer la commande" sans REELLEMENT appeler l'outil Bash
- Si tu n'es pas sur qu'un fichier existe, utilise l'outil Read ou Glob pour verifier — ne devine pas
- Pour les commandes shell : utilise Bash. Pour lire des fichiers : utilise Read. Pour creer : utilise Write. Pour modifier : utilise Edit.
- Le repertoire de travail est : ${this.workspace}
- Tu as acces a TOUT le systeme de fichiers, pas seulement le workspace
- Tu peux naviguer partout : C:\\, /home, /etc, etc.

## Biais d'execution
- Agis d'abord, commente ensuite
- Un tour ou tu ne fais que parler alors que tu pourrais agir est un tour INCOMPLET
- Si l'utilisateur demande de faire quelque chose, FAIS-LE dans le meme tour
- Ne narre pas les actions routinieres — fais-les en silence`);

    // 10. Skills list (descriptions only, for trigger matching)
    const skillsDir = path.join(this.workspace, "skills");
    if (fs.existsSync(skillsDir)) {
      const skillDescriptions: string[] = [];
      for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
          if (fs.existsSync(skillMd)) {
            const content = fs.readFileSync(skillMd, "utf-8");
            // Extract just the description from YAML frontmatter
            const descMatch = content.match(/description:\s*["\']?(.+?)["\']?\s*$/m);
            if (descMatch) {
              skillDescriptions.push(`- ${entry.name}: ${descMatch[1]}`);
            }
          }
        }
      }
      if (skillDescriptions.length > 0) {
        sections.push(`# Skills disponibles
Avant de repondre, scanne cette liste. Si un skill correspond, lis son SKILL.md dans skills/<nom>/SKILL.md puis suis-le.

${skillDescriptions.join("\n")}`);
      }
    }

    // 11. Current date/time
    sections.push(`# Contexte
Date: ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Heure: ${new Date().toLocaleTimeString("fr-FR")}
OS: ${process.platform === "win32" ? "Windows" : process.platform}
Workspace: ${this.workspace}`);

    return sections.join("\n\n---\n\n");
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
