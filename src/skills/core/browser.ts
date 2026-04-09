// src/skills/core/browser.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser, Page } from "playwright";
import path from "path";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

export class BrowserSkill extends BaseSkill {
  name = "browser";
  description = "Navigate the web: search Google, visit pages, read content, take screenshots";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["search", "goto", "read", "click", "screenshot", "close"],
        description: "Browser action to perform",
      },
      query: {
        type: "string",
        description: "Search query (for search action)",
      },
      url: {
        type: "string",
        description: "URL to navigate to (for goto action)",
      },
      selector: {
        type: "string",
        description: "CSS selector (for click/read actions)",
      },
    },
    required: ["action"],
  };

  private browser: Browser | null = null;
  private page: Page | null = null;

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;

    try {
      switch (action) {
        case "search":
          return await this.search(args.query as string, context);
        case "goto":
          return await this.goto(args.url as string);
        case "read":
          return await this.read(args.selector as string | undefined);
        case "click":
          return await this.click(args.selector as string);
        case "screenshot":
          return await this.screenshot(context);
        case "close":
          return await this.close();
        default:
          throw new SkillError(`Unknown action: ${action}`);
      }
    } catch (error) {
      if (error instanceof SkillError) throw error;
      logger.error(`Browser error: ${error}`);
      return `Browser error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async ensureBrowser(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.page = await this.browser.newPage();
    }
    return this.page!;
  }

  private async search(query: string, context: SkillContext): Promise<string> {
    if (!query) throw new SkillError("Query is required for search action");

    const page = await this.ensureBrowser();
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);

    // Extract search results
    const results = await page.evaluate(() => {
      const items = document.querySelectorAll(".g");
      return Array.from(items)
        .slice(0, 5)
        .map((item: Element) => {
          const title = item.querySelector("h3")?.textContent || "";
          const link = (item.querySelector("a") as HTMLAnchorElement | null)?.href || "";
          const snippet = item.querySelector(".VwiC3b")?.textContent || "";
          return { title, link, snippet };
        })
        .filter((item: { title: string; link: string; snippet: string }) => item.title && item.link);
    });

    if (results.length === 0) {
      return "No search results found";
    }

    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`)
      .join("\n\n");
  }

  private async goto(url: string): Promise<string> {
    if (!url) throw new SkillError("URL is required for goto action");

    const page = await this.ensureBrowser();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    return `Loaded: ${title} (${url})`;
  }

  private async read(selector?: string): Promise<string> {
    const page = await this.ensureBrowser();

    if (selector) {
      const content = await page.$eval(selector, (el) => el.textContent || "");
      return content.trim().slice(0, 5000);
    }

    const content = await page.evaluate(() => {
      const body = document.body;
      // Remove scripts which contain unwanted text
      const scripts = body.querySelectorAll("script, style, noscript");
      scripts.forEach((s: Element) => s.remove());
      return body.innerText || "";
    });

    return content.trim().slice(0, 5000);
  }

  private async click(selector: string): Promise<string> {
    if (!selector) throw new SkillError("Selector is required for click action");

    const page = await this.ensureBrowser();
    await page.click(selector);
    return `Clicked: ${selector}`;
  }

  private async screenshot(context: SkillContext): Promise<string> {
    const page = await this.ensureBrowser();
    const filename = `screenshot-${Date.now()}.png`;
    const filepath = path.join(context.workspace, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    return `Screenshot saved: ${filename}`;
  }

  private async close(): Promise<string> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      return "Browser closed";
    }
    return "Browser was not open";
  }
}
