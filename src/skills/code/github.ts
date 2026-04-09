import { BaseSkill, SkillContext } from "../base.js";

export class GitHubSkill extends BaseSkill {
  name = "github";
  description = "Interagir avec l'API GitHub";
  category = "code";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["repos", "issues", "prs", "create-issue"], description: "Action" },
      owner: { type: "string", description: "Owner du repo" },
      repo: { type: "string", description: "Nom du repo" },
      title: { type: "string", description: "Titre (pour create-issue)" },
      body: { type: "string", description: "Body (pour create-issue)" },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const owner = args.owner as string;
    const repo = args.repo as string;
    const token = process.env.GITHUB_TOKEN;

    const headers: Record<string, string> = { "Accept": "application/vnd.github.v3+json", "User-Agent": "NovaClaw" };
    if (token) headers["Authorization"] = `token ${token}`;

    if (action === "repos") {
      const res = await fetch(`https://api.github.com/users/${owner}/repos?per_page=10`, { headers });
      const data = await res.json();
      return Array.isArray(data) ? data.map((r: any) => `${r.full_name} - ${r.description || "No desc"}`).join("\n") : JSON.stringify(data);
    }
    if (action === "issues" && owner && repo) {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`, { headers });
      const data = await res.json();
      return Array.isArray(data) ? data.map((i: any) => `#${i.number} ${i.title}`).join("\n") : JSON.stringify(data);
    }
    if (action === "prs" && owner && repo) {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=10`, { headers });
      const data = await res.json();
      return Array.isArray(data) ? data.map((p: any) => `#${p.number} ${p.title}`).join("\n") : JSON.stringify(data);
    }
    return "Action ou paramètres manquants. Utilisez: repos (+ owner), issues/prs (+ owner + repo)";
  }
}
