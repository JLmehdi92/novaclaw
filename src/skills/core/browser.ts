// src/skills/core/browser.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser, Page } from "playwright";
import path from "path";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { authManager } from "../../security/auth.js";

const BROWSER_TIMEOUT = 5 * 60 * 1000; // 5 minutes idle timeout
const PAGE_TIMEOUT = 30000; // 30 seconds for page operations

export class BrowserSkill extends BaseSkill {
  name = "browser";
  description = "Naviguer sur le web: rechercher, visiter des pages, lire du contenu, screenshots";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["search", "goto", "read", "click", "screenshot", "close"],
        description: "Action à effectuer",
      },
      query: {
        type: "string",
        description: "Requête de recherche (pour search)",
      },
      url: {
        type: "string",
        description: "URL à visiter (pour goto)",
      },
      selector: {
        type: "string",
        description: "Sélecteur CSS (pour click/read)",
      },
    },
    required: ["action"],
  };

  private browser: Browser | null = null;
  private page: Page | null = null;
  private lastActivity: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;

    if (!action || typeof action !== "string") {
      throw new SkillError("Action invalide");
    }

    try {
      this.lastActivity = Date.now();
      this.scheduleCleanup();

      logger.info(`[Browser] User ${context.userId}: ${action}`);

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
          throw new SkillError(`Action inconnue: ${action}`);
      }
    } catch (error) {
      if (error instanceof SkillError) throw error;

      logger.error(`[Browser] Erreur: ${error}`);

      // Auto-cleanup on error
      await this.forceClose();

      return `Erreur browser: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private scheduleCleanup(): void {
    // Clear existing timer
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }

    // Schedule cleanup after idle timeout
    this.cleanupTimer = setTimeout(async () => {
      const idleTime = Date.now() - this.lastActivity;
      if (idleTime >= BROWSER_TIMEOUT && this.browser) {
        logger.info("[Browser] Auto-closing due to inactivity");
        await this.forceClose();
      }
    }, BROWSER_TIMEOUT);
  }

  private async ensureBrowser(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      // Close any stale instance
      await this.forceClose();

      logger.debug("[Browser] Launching new browser instance");
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ]
      });

      this.page = await this.browser.newPage();
      this.page.setDefaultTimeout(PAGE_TIMEOUT);
    }

    if (!this.page || this.page.isClosed()) {
      this.page = await this.browser.newPage();
      this.page.setDefaultTimeout(PAGE_TIMEOUT);
    }

    return this.page;
  }

  private async search(query: string, context: SkillContext): Promise<string> {
    if (!query) throw new SkillError("Query requise pour la recherche");

    const page = await this.ensureBrowser();

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });

    // Wait a bit for dynamic content
    await page.waitForTimeout(1000);

    const results = await page.evaluate(() => {
      const items = document.querySelectorAll(".g");
      return Array.from(items)
        .slice(0, 5)
        .map((item: Element) => {
          const titleEl = item.querySelector("h3");
          const linkEl = item.querySelector("a");
          const snippetEl = item.querySelector(".VwiC3b, .IsZvec");
          return {
            title: titleEl?.textContent || "",
            link: linkEl?.getAttribute("href") || "",
            snippet: snippetEl?.textContent || "",
          };
        })
        .filter((item) => item.title && item.link && item.link.startsWith("http"));
    });

    authManager.logAction(context.userId, "browser_search", { query: query.slice(0, 100) });

    if (results.length === 0) {
      return "Aucun résultat trouvé";
    }

    return results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`)
      .join("\n\n");
  }

  private async goto(url: string): Promise<string> {
    if (!url) throw new SkillError("URL requise pour goto");

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw new SkillError("URL invalide");
    }

    const page = await this.ensureBrowser();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });

    const title = await page.title();
    return `Page chargée: ${title} (${url})`;
  }

  private async read(selector?: string): Promise<string> {
    const page = await this.ensureBrowser();

    if (selector) {
      try {
        const content = await page.$eval(selector, (el: Element) => el.textContent || "");
        return content.trim().slice(0, 5000) || "(élément vide)";
      } catch {
        return `Erreur: Sélecteur "${selector}" non trouvé`;
      }
    }

    const content = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "(page vide)";

      // Clone to avoid modifying the actual page
      const clone = body.cloneNode(true) as HTMLElement;

      // Remove scripts, styles, etc.
      const toRemove = clone.querySelectorAll("script, style, noscript, svg, img, video, audio, iframe");
      toRemove.forEach((el: Element) => el.remove());

      return clone.innerText || "(page vide)";
    });

    return content.trim().slice(0, 5000);
  }

  private async click(selector: string): Promise<string> {
    if (!selector) throw new SkillError("Sélecteur requis pour click");

    const page = await this.ensureBrowser();

    try {
      await page.click(selector, { timeout: PAGE_TIMEOUT });
      await page.waitForTimeout(500); // Wait for potential navigation
      return `Cliqué: ${selector}`;
    } catch {
      return `Erreur: Impossible de cliquer sur "${selector}"`;
    }
  }

  private async screenshot(context: SkillContext): Promise<string> {
    const page = await this.ensureBrowser();

    const filename = `screenshot-${Date.now()}.png`;
    const filepath = path.join(context.workspace, filename);

    await page.screenshot({ path: filepath, fullPage: false });

    authManager.logAction(context.userId, "browser_screenshot", { filename });

    return `Screenshot sauvegardé: ${filename}`;
  }

  private async close(): Promise<string> {
    await this.forceClose();
    return "Browser fermé";
  }

  private async forceClose(): Promise<void> {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.page && !this.page.isClosed()) {
      try {
        await this.page.close();
      } catch {
        // Ignore close errors
      }
    }
    this.page = null;

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
    }
    this.browser = null;

    logger.debug("[Browser] Browser closed and cleaned up");
  }
}
