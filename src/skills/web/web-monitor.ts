// src/skills/web/web-monitor.ts
import { BaseSkill, SkillContext } from "../base.js";
import { chromium, Browser } from "playwright";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export class WebMonitorSkill extends BaseSkill {
  name = "web-monitor";
  description = "Surveiller une page web et détecter les changements";
  category = "web";
  parameters = {
    type: "object" as const,
    properties: {
      action: { type: "string", enum: ["check", "snapshot"], description: "Action" },
      url: { type: "string", description: "URL à surveiller" },
      selector: { type: "string", description: "Sélecteur CSS optionnel" },
      name: { type: "string", description: "Nom du monitoring" },
    },
    required: ["action", "url"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const url = args.url as string;
    const selector = args.selector as string | undefined;
    const name = (args.name as string) || crypto.createHash("md5").update(url).digest("hex").slice(0, 8);
    const snapshotPath = path.join(context.workspace, ".web-monitor", `${name}.json`);
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const content = selector
        ? await page.$eval(selector, el => el.textContent || "").catch(() => "Selector not found")
        : await page.evaluate(() => document.body.innerText);
      const contentHash = crypto.createHash("sha256").update(content).digest("hex");

      if (action === "snapshot") {
        fs.writeFileSync(snapshotPath, JSON.stringify({ url, hash: contentHash, timestamp: new Date().toISOString() }));
        return `Snapshot sauvegardé: ${name}`;
      }

      if (!fs.existsSync(snapshotPath)) {
        fs.writeFileSync(snapshotPath, JSON.stringify({ url, hash: contentHash, timestamp: new Date().toISOString() }));
        return `Premier snapshot créé pour ${name}`;
      }

      const previous = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      if (previous.hash === contentHash) return `Aucun changement sur ${url}`;
      fs.writeFileSync(snapshotPath, JSON.stringify({ url, hash: contentHash, timestamp: new Date().toISOString() }));
      return `⚠️ Changement détecté sur ${url}!`;
    } finally {
      if (browser) await browser.close();
    }
  }
}
