// src/skills/web/screenshot.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";
import path from "path";

export class ScreenshotSkill extends BaseSkill {
  name = "screenshot";
  description = "Capturer une page web en image PNG ou JPEG";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL de la page à capturer" },
      fullPage: { type: "boolean", description: "Capturer toute la page" },
      format: { type: "string", enum: ["png", "jpeg"], description: "Format de l'image" },
      filename: { type: "string", description: "Nom du fichier (optionnel)" },
    },
    required: ["url"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;
    const fullPage = (args.fullPage as boolean) ?? false;
    const format = (args.format as "png" | "jpeg") ?? "png";
    const filename = (args.filename as string) ?? `screenshot-${Date.now()}.${format}`;

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const filepath = path.join(context.workspace, filename);
      await page.screenshot({ path: filepath, fullPage, type: format });
      return `Screenshot sauvegardé: ${filename}`;
    } finally {
      if (browser) await browser.close();
    }
  }
}
