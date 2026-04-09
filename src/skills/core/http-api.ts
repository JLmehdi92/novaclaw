// src/skills/core/http-api.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";

export class HttpApiSkill extends BaseSkill {
  name = "http_api";
  description = "Make HTTP requests to external APIs";
  parameters = {
    type: "object" as const,
    properties: {
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        description: "HTTP method",
      },
      url: {
        type: "string",
        description: "The URL to request",
      },
      headers: {
        type: "object",
        description: "Optional HTTP headers",
      },
      body: {
        type: "string",
        description: "Optional request body (for POST/PUT/PATCH)",
      },
    },
    required: ["method", "url"],
  };

  private readonly TIMEOUT = 30000;

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const method = args.method as string;
    const url = args.url as string;
    const headers = args.headers as Record<string, string> | undefined;
    const body = args.body as string | undefined;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(url, {
        method,
        headers: headers || {},
        body: body || undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let responseBody: string;

      if (contentType.includes("application/json")) {
        const json = await response.json();
        responseBody = JSON.stringify(json, null, 2);
      } else {
        responseBody = await response.text();
      }

      if (!response.ok) {
        return `HTTP ${response.status} ${response.statusText}\n${responseBody}`;
      }

      return responseBody;
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return "Error: Request timeout";
        }
        return `Error: ${error.message}`;
      }
      return `Error: ${String(error)}`;
    }
  }
}
