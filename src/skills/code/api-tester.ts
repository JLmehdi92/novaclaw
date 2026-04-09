import { BaseSkill, SkillContext } from "../base.js";

export class ApiTesterSkill extends BaseSkill {
  name = "api-tester";
  description = "Tester des APIs REST/GraphQL";
  category = "code";
  parameters = {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL de l'API" },
      method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], description: "Méthode HTTP" },
      headers: { type: "object", description: "Headers HTTP" },
      body: { type: "string", description: "Corps de la requête (JSON)" },
    },
    required: ["url"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;
    const method = (args.method as string) || "GET";
    const headers = (args.headers as Record<string, string>) || {};
    const body = args.body as string;

    const options: RequestInit = { method, headers };
    if (body && method !== "GET") options.body = body;
    if (body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

    const start = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - start;
    const text = await response.text();

    let parsed: string;
    try { parsed = JSON.stringify(JSON.parse(text), null, 2); } catch { parsed = text.slice(0, 5000); }

    return `Status: ${response.status} ${response.statusText}\nDuration: ${duration}ms\n\n${parsed}`;
  }
}
