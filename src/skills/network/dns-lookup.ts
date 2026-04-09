// src/skills/network/dns-lookup.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import dns from "dns";
import { promisify } from "util";
import net from "net";

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveNs = promisify(dns.resolveNs);
const resolveCname = promisify(dns.resolveCname);
const reverse = promisify(dns.reverse);

async function safeResolve<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export class DnsLookupSkill extends BaseSkill {
  name = "dns-lookup";
  description =
    "Résolution DNS (A, AAAA, MX, TXT, NS, CNAME), lookup inverse et informations IP de base";
  category = "network";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["resolve", "reverse", "full", "mx", "txt", "ns", "cname"],
        description:
          "Action: resolve (A/AAAA), reverse (PTR), full (tous les types), mx, txt, ns, cname",
      },
      host: {
        type: "string",
        description: "Nom de domaine ou adresse IP à interroger",
      },
      record_type: {
        type: "string",
        enum: ["A", "AAAA", "MX", "TXT", "NS", "CNAME"],
        description: "Type d'enregistrement DNS spécifique (optionnel avec action=resolve)",
      },
    },
    required: ["action", "host"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const host = (args.host as string).trim().toLowerCase();
    const recordType = args.record_type as string | undefined;

    if (!host) throw new SkillError("Hôte invalide");

    logger.info(`[DNS] ${action} ${host} (user: ${context.userId})`);

    switch (action) {
      case "resolve":
        return this.resolveHost(host, recordType);
      case "reverse":
        return this.reverseResolve(host);
      case "full":
        return this.fullLookup(host);
      case "mx":
        return this.resolveMxRecords(host);
      case "txt":
        return this.resolveTxtRecords(host);
      case "ns":
        return this.resolveNsRecords(host);
      case "cname":
        return this.resolveCnameRecords(host);
      default:
        return `Action inconnue: ${action}`;
    }
  }

  private async resolveHost(host: string, recordType?: string): Promise<string> {
    const results: string[] = [`DNS Lookup: ${host}`];

    if (!recordType || recordType === "A") {
      const ipv4 = await safeResolve(() => resolve4(host));
      if (ipv4) results.push(`A (IPv4): ${ipv4.join(", ")}`);
    }

    if (!recordType || recordType === "AAAA") {
      const ipv6 = await safeResolve(() => resolve6(host));
      if (ipv6) results.push(`AAAA (IPv6): ${ipv6.join(", ")}`);
    }

    if (results.length === 1) {
      results.push("Aucun enregistrement A/AAAA trouvé");
    }

    return results.join("\n");
  }

  private async reverseResolve(ip: string): Promise<string> {
    if (!net.isIP(ip)) {
      throw new SkillError(`${ip} n'est pas une adresse IP valide pour le lookup inverse`);
    }

    const hostnames = await safeResolve(() => reverse(ip));

    if (!hostnames || hostnames.length === 0) {
      return `Reverse DNS pour ${ip}: aucun enregistrement PTR trouvé`;
    }

    return [`Reverse DNS (PTR) pour ${ip}:`, ...hostnames.map((h) => `  ${h}`)].join("\n");
  }

  private async fullLookup(host: string): Promise<string> {
    const results: string[] = [`=== DNS Complet: ${host} ===`];

    const [ipv4, ipv6, mx, txt, ns, cname] = await Promise.all([
      safeResolve(() => resolve4(host)),
      safeResolve(() => resolve6(host)),
      safeResolve(() => resolveMx(host)),
      safeResolve(() => resolveTxt(host)),
      safeResolve(() => resolveNs(host)),
      safeResolve(() => resolveCname(host)),
    ]);

    if (ipv4?.length) results.push(`A (IPv4): ${ipv4.join(", ")}`);
    if (ipv6?.length) results.push(`AAAA (IPv6): ${ipv6.join(", ")}`);

    if (cname?.length) results.push(`CNAME: ${cname.join(", ")}`);

    if (ns?.length) results.push(`NS: ${ns.join(", ")}`);

    if (mx?.length) {
      results.push(
        `MX:\n${mx
          .sort((a, b) => a.priority - b.priority)
          .map((r) => `  ${r.priority} ${r.exchange}`)
          .join("\n")}`
      );
    }

    if (txt?.length) {
      results.push(
        `TXT:\n${txt
          .map((r) => `  "${r.join("")}"`)
          .slice(0, 10)
          .join("\n")}`
      );
    }

    // Reverse lookup if we got an IPv4
    if (ipv4?.length) {
      const ptr = await safeResolve(() => reverse(ipv4[0]));
      if (ptr?.length) results.push(`PTR (${ipv4[0]}): ${ptr.join(", ")}`);
    }

    if (results.length === 1) {
      results.push("Aucun enregistrement DNS trouvé");
    }

    return results.join("\n");
  }

  private async resolveMxRecords(host: string): Promise<string> {
    const mx = await safeResolve(() => resolveMx(host));
    if (!mx || mx.length === 0) return `Aucun enregistrement MX pour ${host}`;

    return [
      `MX Records pour ${host}:`,
      ...mx
        .sort((a, b) => a.priority - b.priority)
        .map((r) => `  Priorité ${r.priority}: ${r.exchange}`),
    ].join("\n");
  }

  private async resolveTxtRecords(host: string): Promise<string> {
    const txt = await safeResolve(() => resolveTxt(host));
    if (!txt || txt.length === 0) return `Aucun enregistrement TXT pour ${host}`;

    return [
      `TXT Records pour ${host}:`,
      ...txt.slice(0, 20).map((r, i) => `  [${i + 1}] "${r.join("")}"`),
    ].join("\n");
  }

  private async resolveNsRecords(host: string): Promise<string> {
    const ns = await safeResolve(() => resolveNs(host));
    if (!ns || ns.length === 0) return `Aucun enregistrement NS pour ${host}`;

    return [`NS Records pour ${host}:`, ...ns.map((r) => `  ${r}`)].join("\n");
  }

  private async resolveCnameRecords(host: string): Promise<string> {
    const cname = await safeResolve(() => resolveCname(host));
    if (!cname || cname.length === 0) return `Aucun enregistrement CNAME pour ${host}`;

    return [`CNAME Records pour ${host}:`, ...cname.map((r) => `  ${r}`)].join("\n");
  }
}
