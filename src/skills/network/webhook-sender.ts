// src/skills/network/webhook-sender.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

type WebhookFormat = "generic" | "slack" | "discord";

function buildSlackPayload(message: string, data?: unknown): string {
  const blocks = data
    ? [
        { type: "section", text: { type: "mrkdwn", text: message } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `\`\`\`${JSON.stringify(data, null, 2)}\`\`\``,
          },
        },
      ]
    : [{ type: "section", text: { type: "mrkdwn", text: message } }];
  return JSON.stringify({ blocks });
}

function buildDiscordPayload(message: string, data?: unknown, username?: string): string {
  const embeds = data
    ? [
        {
          description: `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
          color: 0x5865f2,
        },
      ]
    : [];
  const payload: Record<string, unknown> = { content: message, embeds };
  if (username) payload.username = username;
  return JSON.stringify(payload);
}

export class WebhookSenderSkill extends BaseSkill {
  name = "webhook-sender";
  description = "Envoyer des webhooks avec payloads JSON à des services externes (Slack, Discord, générique)";
  category = "network";
  parameters = {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "URL du webhook cible",
      },
      message: {
        type: "string",
        description: "Message principal à envoyer",
      },
      data: {
        type: "object",
        description: "Données supplémentaires à inclure dans le payload",
      },
      format: {
        type: "string",
        enum: ["generic", "slack", "discord"],
        description: "Format du webhook (défaut: generic)",
      },
      username: {
        type: "string",
        description: "Nom d'affichage (pour Discord)",
      },
      headers: {
        type: "object",
        description: "En-têtes HTTP supplémentaires",
      },
      secret: {
        type: "string",
        description: "Secret HMAC pour signer la requête (header X-Webhook-Signature)",
      },
    },
    required: ["url", "message"],
  };

  private readonly TIMEOUT = 15000;

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;
    const message = args.message as string;
    const data = args.data as Record<string, unknown> | undefined;
    const format = ((args.format as string) || "generic") as WebhookFormat;
    const username = args.username as string | undefined;
    const extraHeaders = (args.headers as Record<string, string>) || {};
    const secret = args.secret as string | undefined;

    if (!url || !url.startsWith("http")) {
      throw new SkillError("URL de webhook invalide");
    }

    let body: string;

    switch (format) {
      case "slack":
        body = buildSlackPayload(message, data);
        break;
      case "discord":
        body = buildDiscordPayload(message, data, username);
        break;
      case "generic":
      default: {
        const payload: Record<string, unknown> = { message, timestamp: new Date().toISOString() };
        if (data) payload.data = data;
        body = JSON.stringify(payload);
        break;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "NovaClaw-Webhook/1.0",
      ...extraHeaders,
    };

    // HMAC signature if secret provided
    if (secret) {
      const { createHmac } = await import("crypto");
      const sig = createHmac("sha256", secret).update(body).digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${sig}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      logger.info(`[WebhookSender] Sending ${format} webhook to ${url} (user: ${context.userId})`);

      const startTime = Date.now();
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      const duration = Date.now() - startTime;

      const responseText = await response.text().catch(() => "");

      if (response.ok) {
        return [
          `Webhook envoyé avec succès`,
          `Status: ${response.status} ${response.statusText}`,
          `Format: ${format}`,
          `Duration: ${duration}ms`,
          `URL: ${url}`,
          responseText ? `Réponse: ${responseText.slice(0, 500)}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      } else {
        return [
          `Webhook envoyé mais statut non-OK`,
          `Status: ${response.status} ${response.statusText}`,
          `Duration: ${duration}ms`,
          responseText ? `Réponse: ${responseText.slice(0, 500)}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new SkillError(`Timeout: webhook non livré après ${this.TIMEOUT}ms`);
      }
      throw new SkillError(
        `Erreur envoi webhook: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
