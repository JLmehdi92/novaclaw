// src/skills/network/http.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { URL } from "url";

// Private/reserved IP ranges for SSRF protection
const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback
  /^10\./,                           // Private class A
  /^172\.(1[6-9]|2\d|3[01])\./,     // Private class B
  /^192\.168\./,                     // Private class C
  /^169\.254\./,                     // Link-local
  /^::1$/,                           // IPv6 loopback
  /^fc00:/i,                         // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
  /^0\./,                            // Reserved
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // Shared address space
];

const BLOCKED_HOSTS = ["localhost", "metadata.google.internal", "169.254.169.254"];

function isPrivateOrBlocked(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(hostname)) return true;
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export class HttpSkill extends BaseSkill {
  name = "http-request";
  description = "Effectuer des requêtes HTTP (GET, POST, PUT, DELETE) vers des URLs externes";
  category = "network";
  parameters = {
    type: "object" as const,
    properties: {
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        description: "Méthode HTTP",
      },
      url: {
        type: "string",
        description: "URL cible de la requête",
      },
      headers: {
        type: "object",
        description: "En-têtes HTTP (clé: valeur)",
      },
      body: {
        type: "string",
        description: "Corps de la requête (JSON ou texte)",
      },
      timeout: {
        type: "number",
        description: "Timeout en millisecondes (défaut: 15000, max: 60000)",
      },
      allow_private: {
        type: "boolean",
        description: "Autoriser les IPs privées (désactivé par défaut pour sécurité SSRF)",
      },
    },
    required: ["method", "url"],
  };

  private readonly MAX_TIMEOUT = 60000;
  private readonly DEFAULT_TIMEOUT = 15000;
  private readonly MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const method = (args.method as string).toUpperCase();
    const url = args.url as string;
    const headers = (args.headers as Record<string, string>) || {};
    const body = args.body as string | undefined;
    const allowPrivate = (args.allow_private as boolean) || false;
    const timeoutMs = Math.min(
      (args.timeout as number) || this.DEFAULT_TIMEOUT,
      this.MAX_TIMEOUT
    );

    if (!url || typeof url !== "string") {
      throw new SkillError("URL invalide");
    }

    // SSRF protection
    if (!allowPrivate && isPrivateOrBlocked(url)) {
      throw new SkillError(
        "Accès refusé: URL pointe vers une ressource privée/locale (protection SSRF)"
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new SkillError(`URL malformée: ${url}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && !["GET", "HEAD"].includes(method)) {
      fetchOptions.body = body;
      if (!headers["Content-Type"] && !headers["content-type"]) {
        (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
    }

    const startTime = Date.now();

    try {
      logger.info(`[HTTP] ${method} ${url} (user: ${context.userId})`);

      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      // Read response with size limit
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const truncated = buffer.length > this.MAX_RESPONSE_SIZE;
      const text = buffer.slice(0, this.MAX_RESPONSE_SIZE).toString("utf-8");

      // Try to format as JSON
      let bodyStr: string;
      try {
        bodyStr = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        bodyStr = text;
      }

      // Collect response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const result = [
        `Status: ${response.status} ${response.statusText}`,
        `Duration: ${duration}ms`,
        `URL: ${response.url}`,
        `Headers: ${JSON.stringify(responseHeaders, null, 2)}`,
        `Body:`,
        bodyStr,
        truncated ? "\n... [réponse tronquée à 2MB]" : "",
      ].join("\n");

      return result;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new SkillError(`Timeout: la requête a dépassé ${timeoutMs}ms`);
      }
      throw new SkillError(
        `Erreur HTTP: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
