// src/skills/core/http-api.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { authManager } from "../../security/auth.js";

// Private IP ranges to block
const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // Loopback
  /^10\./,                     // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./,               // Class C private
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^224\./,                    // Multicast
  /^240\./,                    // Reserved
  /^255\./,                    // Broadcast
  /^localhost$/i,
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 private
  /^fe80:/i,                   // IPv6 link-local
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "metadata.google.internal",
  "169.254.169.254",           // Cloud metadata
  "metadata.google.com",
  "kubernetes.default",
];

export class HttpApiSkill extends BaseSkill {
  name = "http_api";
  description = "Faire des requêtes HTTP vers des APIs externes";
  parameters = {
    type: "object" as const,
    properties: {
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        description: "Méthode HTTP",
      },
      url: {
        type: "string",
        description: "L'URL à requêter",
      },
      headers: {
        type: "object",
        description: "Headers HTTP optionnels",
      },
      body: {
        type: "string",
        description: "Corps de la requête (pour POST/PUT/PATCH)",
      },
    },
    required: ["method", "url"],
  };

  private readonly TIMEOUT = 30000;
  private readonly MAX_RESPONSE_SIZE = 1000000; // 1MB

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const method = args.method as string;
    const url = args.url as string;
    const headers = args.headers as Record<string, string> | undefined;
    const body = args.body as string | undefined;

    if (!url || typeof url !== "string") {
      throw new SkillError("URL invalide");
    }

    // Validate URL
    const validationError = this.validateUrl(url, authManager.isOwner(context.userId));
    if (validationError) {
      throw new SkillError(validationError);
    }

    try {
      logger.info(`[HTTP] User ${context.userId}: ${method} ${url.slice(0, 100)}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(url, {
        method,
        headers: {
          "User-Agent": "NovaClaw/1.0",
          ...headers,
        },
        body: body || undefined,
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      // Check response size via Content-Length if available
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > this.MAX_RESPONSE_SIZE) {
        return `Erreur: Réponse trop grande (${contentLength} bytes, max ${this.MAX_RESPONSE_SIZE})`;
      }

      const contentType = response.headers.get("content-type") || "";
      let responseBody: string;

      if (contentType.includes("application/json")) {
        const json = await response.json();
        responseBody = JSON.stringify(json, null, 2);
      } else {
        responseBody = await response.text();
      }

      // Truncate if too large
      if (responseBody.length > this.MAX_RESPONSE_SIZE) {
        responseBody = responseBody.slice(0, this.MAX_RESPONSE_SIZE) + "\n... (tronqué)";
      }

      authManager.logAction(context.userId, "http_request", {
        method,
        url: url.slice(0, 200),
        status: response.status,
      });

      if (!response.ok) {
        return `HTTP ${response.status} ${response.statusText}\n${responseBody}`;
      }

      return responseBody;
    } catch (error: unknown) {
      authManager.logAction(context.userId, "http_request", {
        method,
        url: url.slice(0, 200),
        error: error instanceof Error ? error.message : "Unknown",
      });

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return "Erreur: Timeout de la requête (30s)";
        }
        return `Erreur: ${error.message}`;
      }
      return `Erreur: ${String(error)}`;
    }
  }

  private validateUrl(urlString: string, isOwner: boolean): string | null {
    let parsed: URL;

    try {
      parsed = new URL(urlString);
    } catch {
      return "URL invalide ou mal formée";
    }

    // Only allow HTTP and HTTPS
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return `Protocole non autorisé: ${parsed.protocol} (utilisez http ou https)`;
    }

    // Skip further checks for owner
    if (isOwner) {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (BLOCKED_HOSTNAMES.some(blocked => hostname === blocked || hostname.endsWith("." + blocked))) {
      return `Hostname bloqué: ${hostname}`;
    }

    // Check if hostname looks like an IP address
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      // Check against private IP patterns
      for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return `Adresse IP privée non autorisée: ${hostname}`;
        }
      }
    }

    // Check for IPv6 private addresses
    if (hostname.startsWith("[")) {
      for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return `Adresse IPv6 privée non autorisée: ${hostname}`;
        }
      }
    }

    return null;
  }
}
