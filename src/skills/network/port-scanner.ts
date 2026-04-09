// src/skills/network/port-scanner.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import net from "net";

// Well-known ports with descriptions
const COMMON_PORTS: Record<number, string> = {
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  80: "HTTP",
  110: "POP3",
  143: "IMAP",
  443: "HTTPS",
  465: "SMTPS",
  587: "SMTP/TLS",
  993: "IMAPS",
  995: "POP3S",
  1433: "MSSQL",
  1521: "Oracle DB",
  3000: "HTTP (dev)",
  3306: "MySQL",
  3389: "RDP",
  4000: "HTTP (dev)",
  5000: "HTTP (dev)",
  5432: "PostgreSQL",
  5900: "VNC",
  6379: "Redis",
  6443: "Kubernetes API",
  7000: "HTTP (dev)",
  8000: "HTTP (dev)",
  8080: "HTTP (alt)",
  8443: "HTTPS (alt)",
  8888: "HTTP (dev)",
  9000: "HTTP (dev)",
  9200: "Elasticsearch",
  9300: "Elasticsearch (cluster)",
  27017: "MongoDB",
  27018: "MongoDB",
};

const DEFAULT_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 3306, 3389, 5432, 6379, 8080, 27017];

// Safety limits
const MAX_PORTS_PER_SCAN = 200;
const MAX_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_CONCURRENCY = 20;

function isPrivateIP(host: string): boolean {
  const privatePatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];
  return privatePatterns.some((p) => p.test(host));
}

async function checkPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const done = (open: boolean) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(open);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.once("close", () => done(false));

    socket.connect(port, host);
  });
}

async function scanBatch(
  host: string,
  ports: number[],
  timeoutMs: number,
  concurrency: number
): Promise<{ port: number; open: boolean }[]> {
  const results: { port: number; open: boolean }[] = [];
  const chunks: number[][] = [];

  for (let i = 0; i < ports.length; i += concurrency) {
    chunks.push(ports.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (port) => ({
        port,
        open: await checkPort(host, port, timeoutMs),
      }))
    );
    results.push(...chunkResults);
  }

  return results;
}

export class PortScannerSkill extends BaseSkill {
  name = "port-scanner";
  description =
    "Scanner les ports ouverts sur un hôte (TCP). Inclut des limites de sécurité pour éviter les abus.";
  category = "network";
  parameters = {
    type: "object" as const,
    properties: {
      host: {
        type: "string",
        description: "Nom de domaine ou adresse IP à scanner",
      },
      ports: {
        type: "array",
        items: { type: "number" },
        description: "Liste de ports à scanner (max 200). Si omis, utilise les ports communs.",
      },
      port_range: {
        type: "string",
        description: "Plage de ports au format '80-443' (max 200 ports)",
      },
      timeout: {
        type: "number",
        description: `Timeout par port en ms (défaut: ${DEFAULT_TIMEOUT_MS}, max: ${MAX_TIMEOUT_MS})`,
      },
      show_closed: {
        type: "boolean",
        description: "Afficher aussi les ports fermés (défaut: false)",
      },
    },
    required: ["host"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const host = (args.host as string).trim();
    const showClosed = (args.show_closed as boolean) || false;
    const timeoutMs = Math.min(
      (args.timeout as number) || DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS
    );

    if (!host) throw new SkillError("Hôte invalide");

    // Build port list
    let portsToScan: number[] = [];

    if (args.port_range && typeof args.port_range === "string") {
      const match = (args.port_range as string).match(/^(\d+)-(\d+)$/);
      if (!match) throw new SkillError("Format plage invalide. Utiliser '80-443'");
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      if (start < 1 || end > 65535 || start > end) {
        throw new SkillError("Plage de ports invalide (1-65535)");
      }
      for (let p = start; p <= Math.min(end, start + MAX_PORTS_PER_SCAN - 1); p++) {
        portsToScan.push(p);
      }
    } else if (args.ports && Array.isArray(args.ports)) {
      portsToScan = (args.ports as number[])
        .map((p) => Math.floor(Number(p)))
        .filter((p) => p >= 1 && p <= 65535)
        .slice(0, MAX_PORTS_PER_SCAN);
    } else {
      portsToScan = DEFAULT_PORTS;
    }

    if (portsToScan.length === 0) throw new SkillError("Aucun port valide à scanner");
    if (portsToScan.length > MAX_PORTS_PER_SCAN) {
      throw new SkillError(`Trop de ports. Maximum: ${MAX_PORTS_PER_SCAN}`);
    }

    logger.info(
      `[PortScanner] Scanning ${portsToScan.length} ports on ${host} (user: ${context.userId})`
    );

    const isPrivate = isPrivateIP(host) || host === "localhost";
    const startTime = Date.now();

    const results = await scanBatch(host, portsToScan, timeoutMs, DEFAULT_CONCURRENCY);
    const duration = Date.now() - startTime;

    const open = results.filter((r) => r.open);
    const closed = results.filter((r) => !r.open);

    const lines: string[] = [
      `=== Scan de ports: ${host} ===`,
      `Ports scannés: ${portsToScan.length} | Timeout: ${timeoutMs}ms | Durée: ${duration}ms`,
      isPrivate ? "(Hôte local/privé)" : "",
      ``,
      `Ports OUVERTS: ${open.length}`,
    ].filter((l) => l !== undefined);

    if (open.length === 0) {
      lines.push("  Aucun port ouvert détecté");
    } else {
      for (const { port } of open.sort((a, b) => a.port - b.port)) {
        const service = COMMON_PORTS[port] || "inconnu";
        lines.push(`  OUVERT  ${String(port).padEnd(6)} ${service}`);
      }
    }

    if (showClosed && closed.length > 0) {
      lines.push(`\nPorts FERMÉS: ${closed.length}`);
      for (const { port } of closed.sort((a, b) => a.port - b.port)) {
        const service = COMMON_PORTS[port] || "";
        lines.push(`  fermé   ${String(port).padEnd(6)} ${service}`);
      }
    }

    lines.push(
      `\nLégende: Port ouvert = connexion TCP établie dans ${timeoutMs}ms`
    );

    return lines.join("\n");
  }
}
