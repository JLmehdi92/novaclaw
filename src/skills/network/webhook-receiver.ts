// src/skills/network/webhook-receiver.ts
import { BaseSkill, SkillContext } from "../base.js";
import { logger } from "../../utils/logger.js";

/**
 * WebhookReceiverSkill - Manage an HTTP server that receives incoming webhooks.
 *
 * NOTE: Running a persistent HTTP server inside the agent's process requires:
 *   1. A publicly accessible IP/domain (or tunnel like ngrok/cloudflare)
 *   2. Port-forwarding / firewall rules on the host machine
 *   3. The agent process must stay alive for the duration
 *
 * This skill provides:
 *   - "start" action: starts a local HTTP listener on a given port and logs
 *     received payloads.  The server runs until stopped or the process exits.
 *   - "stop"  action: stops the currently running listener.
 *   - "status" action: reports whether a listener is active and what payloads
 *     have been received so far (last 20).
 */

import http from "http";

interface ReceivedWebhook {
  timestamp: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

let activeServer: http.Server | null = null;
let activePort: number | null = null;
const receivedWebhooks: ReceivedWebhook[] = [];
const MAX_STORED = 20;

export class WebhookReceiverSkill extends BaseSkill {
  name = "webhook-receiver";
  description =
    "Démarrer/arrêter un serveur HTTP local pour recevoir des webhooks entrants et inspecter les payloads";
  category = "network";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["start", "stop", "status"],
        description: "Action: start (démarrer le serveur), stop (arrêter), status (voir les webhooks reçus)",
      },
      port: {
        type: "number",
        description: "Port d'écoute (défaut: 8765, utilisé uniquement avec action=start)",
      },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;

    switch (action) {
      case "start":
        return this.startServer(args.port as number | undefined, context);
      case "stop":
        return this.stopServer();
      case "status":
        return this.getStatus();
      default:
        return `Action inconnue: ${action}. Utiliser start, stop ou status.`;
    }
  }

  private async startServer(port: number | undefined, context: SkillContext): Promise<string> {
    if (activeServer) {
      return `Un serveur webhook est déjà actif sur le port ${activePort}.\nUtilisez l'action "stop" d'abord.`;
    }

    const listenPort = port || 8765;

    if (listenPort < 1024 || listenPort > 65535) {
      return `Port invalide: ${listenPort}. Choisissez entre 1024 et 65535.`;
    }

    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];

        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            headers[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
          }

          const webhook: ReceivedWebhook = {
            timestamp: new Date().toISOString(),
            method: req.method || "UNKNOWN",
            path: req.url || "/",
            headers,
            body: body.slice(0, 10000),
          };

          receivedWebhooks.unshift(webhook);
          if (receivedWebhooks.length > MAX_STORED) {
            receivedWebhooks.splice(MAX_STORED);
          }

          logger.info(`[WebhookReceiver] Received ${req.method} ${req.url} on port ${listenPort}`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ received: true, timestamp: webhook.timestamp }));
        });
      });

      server.listen(listenPort, "0.0.0.0", () => {
        activeServer = server;
        activePort = listenPort;
        logger.info(`[WebhookReceiver] Server started on port ${listenPort} (user: ${context.userId})`);
        resolve(
          [
            `Serveur webhook démarré sur le port ${listenPort}`,
            ``,
            `IMPORTANT - Pour recevoir des webhooks depuis internet:`,
            `  • Le port ${listenPort} doit être ouvert dans votre pare-feu`,
            `  • Ou utilisez un tunnel comme ngrok: npx ngrok http ${listenPort}`,
            `  • URL locale: http://localhost:${listenPort}`,
            ``,
            `Utilisez action="status" pour voir les webhooks reçus.`,
            `Utilisez action="stop" pour arrêter le serveur.`,
          ].join("\n")
        );
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(`Erreur: Port ${listenPort} déjà utilisé. Choisissez un autre port.`);
        } else {
          resolve(`Erreur serveur: ${err.message}`);
        }
      });
    });
  }

  private async stopServer(): Promise<string> {
    if (!activeServer) {
      return "Aucun serveur webhook n'est actif.";
    }

    return new Promise((resolve) => {
      activeServer!.close(() => {
        const port = activePort;
        activeServer = null;
        activePort = null;
        logger.info(`[WebhookReceiver] Server stopped`);
        resolve(`Serveur webhook sur le port ${port} arrêté.`);
      });
    });
  }

  private getStatus(): string {
    if (!activeServer) {
      const count = receivedWebhooks.length;
      return [
        `Serveur webhook: INACTIF`,
        count > 0
          ? `${count} webhook(s) reçu(s) lors de la dernière session:\n${this.formatWebhooks()}`
          : `Aucun webhook reçu.`,
      ].join("\n");
    }

    return [
      `Serveur webhook: ACTIF sur le port ${activePort}`,
      `Webhooks reçus: ${receivedWebhooks.length}`,
      receivedWebhooks.length > 0 ? `\nDerniers webhooks:\n${this.formatWebhooks()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private formatWebhooks(): string {
    return receivedWebhooks
      .slice(0, 5)
      .map((wh, i) => {
        let bodyPreview: string;
        try {
          bodyPreview = JSON.stringify(JSON.parse(wh.body), null, 2).slice(0, 300);
        } catch {
          bodyPreview = wh.body.slice(0, 300);
        }
        return [
          `--- Webhook ${i + 1} [${wh.timestamp}] ---`,
          `${wh.method} ${wh.path}`,
          `Body: ${bodyPreview}${bodyPreview.length >= 300 ? "..." : ""}`,
        ].join("\n");
      })
      .join("\n\n");
  }
}
