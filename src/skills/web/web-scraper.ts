// src/skills/web/web-scraper.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";

export class WebScraperSkill extends BaseSkill {
  name = "web-scraper";
  description = "Extraire des données structurées d'une page web";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL de la page" },
      selector: { type: "string", description: "Sélecteur CSS des éléments" },
      attributes: { type: "array", items: { type: "string" }, description: "Attributs à extraire (text, href, src)" },
      limit: { type: "number", description: "Nombre max d'éléments" },
    },
    required: ["url", "selector"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const url = args.url as string;
    const selector = args.selector as string;
    const attributes = (args.attributes as string[]) ?? ["text"];
    const limit = (args.limit as number) ?? 50;

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const results = await page.$$eval(
        selector,
        (elements: Element[], { attrs, lim }: { attrs: string[]; lim: number }) => {
          return elements.slice(0, lim).map(el => {
            const data: Record<string, string> = {};
            for (const attr of attrs) {
              if (attr === "text") data.text = el.textContent?.trim() || "";
              else if (attr === "html") data.html = (el as HTMLElement).innerHTML;
              else data[attr] = el.getAttribute(attr) || "";
            }
            return data;
          });
        },
        { attrs: attributes, lim: limit }
      );
      return JSON.stringify(results, null, 2);
    } finally {
      if (browser) await browser.close();
    }
  }
}
