// src/skills/web/link-preview.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";

export class LinkPreviewSkill extends BaseSkill {
  name = "link-preview";
  description = "Prévisualiser un lien (titre, description, image)";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL à prévisualiser" },
    },
    required: ["url"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      const metadata = await page.evaluate(() => {
        const getMeta = (name: string) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content") || "";
        return {
          title: document.title || getMeta("og:title"),
          description: getMeta("og:description") || getMeta("description"),
          image: getMeta("og:image"),
          siteName: getMeta("og:site_name"),
        };
      });
      return JSON.stringify({ url, ...metadata }, null, 2);
    } finally {
      if (browser) await browser.close();
    }
  }
}
