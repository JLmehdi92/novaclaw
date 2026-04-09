import { BaseSkill, SkillContext } from "../base.js";
import os from "os";
import { execSync } from "child_process";

export class SystemInfoSkill extends BaseSkill {
  name = "system-info";
  description = "Informations système (CPU, RAM, disque, réseau)";
  category = "system";
  parameters = {
    type: "object" as const,
    properties: {
      type: { type: "string", enum: ["all", "cpu", "memory", "disk", "network", "os"], description: "Type d'info" },
    },
    required: ["type"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const type = args.type as string;
    const results: string[] = [];

    if (type === "all" || type === "os") {
      results.push(`=== OS ===\nPlatform: ${os.platform()}\nRelease: ${os.release()}\nHostname: ${os.hostname()}\nUptime: ${Math.floor(os.uptime() / 3600)}h`);
    }
    if (type === "all" || type === "cpu") {
      const cpus = os.cpus();
      results.push(`\n=== CPU ===\nModel: ${cpus[0]?.model}\nCores: ${cpus.length}\nLoad: ${os.loadavg().map(l => l.toFixed(2)).join(", ")}`);
    }
    if (type === "all" || type === "memory") {
      const total = os.totalmem(), free = os.freemem(), used = total - free;
      results.push(`\n=== Memory ===\nTotal: ${(total / 1024 / 1024 / 1024).toFixed(1)} GB\nUsed: ${(used / 1024 / 1024 / 1024).toFixed(1)} GB (${((used / total) * 100).toFixed(0)}%)`);
    }
    if (type === "all" || type === "disk") {
      try {
        const cmd = os.platform() === "win32" ? "wmic logicaldisk get size,freespace,caption" : "df -h /";
        results.push(`\n=== Disk ===\n${execSync(cmd, { encoding: "utf-8" }).trim()}`);
      } catch { results.push("\n=== Disk ===\nUnavailable"); }
    }
    if (type === "all" || type === "network") {
      results.push("\n=== Network ===");
      for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
        for (const addr of addrs || []) {
          if (addr.family === "IPv4" && !addr.internal) results.push(`${name}: ${addr.address}`);
        }
      }
    }
    return results.join("\n");
  }
}
