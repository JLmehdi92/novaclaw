// src/skills/communication/email-reader.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import * as net from "net";
import * as tls from "tls";

// ---------------------------------------------------------------------------
// Minimal IMAP client using Node's built-in net/tls modules
// Implements just enough of RFC 3501 to: LIST mailboxes, SEARCH+FETCH headers, FETCH body
// ---------------------------------------------------------------------------

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean; // true = implicit TLS (993), false = STARTTLS (143)
}

interface ImapMessage {
  uid: number;
  from: string;
  subject: string;
  date: string;
  preview: string;
  size?: number;
}

type ImapAction = "list_mailboxes" | "list_messages" | "read_message";

interface EmailReaderArgs {
  action: ImapAction;
  folder?: string;
  limit?: number;
  uid?: number;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  imap_pass?: string;
  imap_secure?: boolean;
}

// ---------------------------------------------------------------------------
// IMAP low-level helpers
// ---------------------------------------------------------------------------

class ImapClient {
  private socket!: net.Socket | tls.TLSSocket;
  private tagCounter = 1;
  private buffer = "";
  private responseHandlers: Array<(line: string) => void> = [];

  constructor(private cfg: ImapConfig) {}

  private nextTag(): string {
    return `A${String(this.tagCounter++).padStart(4, "0")}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf-8");
        this.flushBuffer();
      };

      const opts = { host: this.cfg.host, port: this.cfg.port, rejectUnauthorized: false };

      if (this.cfg.secure) {
        this.socket = tls.connect(opts);
      } else {
        this.socket = net.connect({ host: this.cfg.host, port: this.cfg.port });
      }

      this.socket.on("data", onData);
      this.socket.on("error", reject);

      // Wait for server greeting (starts with * OK)
      const waitGreeting = (line: string) => {
        if (line.startsWith("* OK")) {
          this.responseHandlers.shift();
          resolve();
        } else if (line.startsWith("* BYE") || line.startsWith("* NO")) {
          reject(new Error(`IMAP greeting failed: ${line}`));
        }
      };
      this.responseHandlers.push(waitGreeting);
    });
  }

  private flushBuffer() {
    const lines = this.buffer.split("\r\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      logger.debug(`[EmailReader] <<< ${line}`);
      const handler = this.responseHandlers[0];
      if (handler) handler(line);
    }
  }

  async sendCommand(cmd: string): Promise<string[]> {
    const tag = this.nextTag();
    const fullCmd = `${tag} ${cmd}`;
    logger.debug(`[EmailReader] >>> ${fullCmd}`);

    return new Promise((resolve, reject) => {
      const responses: string[] = [];

      const handler = (line: string) => {
        if (line.startsWith(tag)) {
          this.responseHandlers.shift();
          if (line.includes("OK")) {
            resolve(responses);
          } else {
            reject(new Error(`IMAP command failed: ${line}`));
          }
        } else {
          responses.push(line);
        }
      };

      this.responseHandlers.push(handler);
      this.socket.write(fullCmd + "\r\n");
    });
  }

  async login(): Promise<void> {
    await this.sendCommand(`LOGIN "${escapeImap(this.cfg.user)}" "${escapeImap(this.cfg.pass)}"`);
  }

  async listMailboxes(): Promise<string[]> {
    const lines = await this.sendCommand('LIST "" "*"');
    return lines
      .filter((l) => l.startsWith("* LIST"))
      .map((l) => {
        // * LIST (\HasNoChildren) "/" "INBOX"
        const m = l.match(/"([^"]+)"\s*$/) || l.match(/\s(\S+)\s*$/);
        return m ? m[1] : l;
      });
  }

  async selectFolder(folder: string): Promise<void> {
    await this.sendCommand(`SELECT "${escapeImap(folder)}"`);
  }

  async searchAll(limit: number): Promise<number[]> {
    const lines = await this.sendCommand("SEARCH ALL");
    const searchLine = lines.find((l) => l.startsWith("* SEARCH"));
    if (!searchLine) return [];
    const ids = searchLine
      .replace("* SEARCH", "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    // Return the last `limit` messages (most recent)
    return ids.slice(-limit).reverse();
  }

  async fetchHeaders(ids: number[]): Promise<ImapMessage[]> {
    if (ids.length === 0) return [];
    const idStr = ids.join(",");
    const lines = await this.sendCommand(
      `FETCH ${idStr} (UID RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`
    );
    return parseHeaderFetch(lines, ids);
  }

  async fetchBody(uid: number): Promise<string> {
    const lines = await this.sendCommand(`FETCH ${uid} (BODY[])`);
    // Collect everything between the literal start and the closing ")"
    const combined = lines.join("\r\n");
    // Strip the outer FETCH wrapper
    const start = combined.indexOf("{");
    const braceClose = combined.indexOf("}", start);
    const content = braceClose !== -1 ? combined.slice(braceClose + 3) : combined;
    // Remove the trailing ) added by FETCH
    return content.replace(/\)\s*$/, "").trim();
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand("LOGOUT");
    } catch {
      // ignore
    }
    this.socket.destroy();
  }
}

function escapeImap(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseHeaderFetch(lines: string[], ids: number[]): ImapMessage[] {
  const messages: ImapMessage[] = [];
  let current: Partial<ImapMessage> | null = null;
  let inHeader = false;

  for (const line of lines) {
    // Start of a FETCH response block: * <id> FETCH
    if (/^\* \d+ FETCH/.test(line)) {
      if (current && current.uid) {
        messages.push(finalize(current));
      }
      const idMatch = line.match(/^\* (\d+) FETCH/);
      const uid = idMatch ? parseInt(idMatch[1], 10) : ids[messages.length] ?? 0;
      const sizeMatch = line.match(/RFC822\.SIZE (\d+)/);
      current = { uid, size: sizeMatch ? parseInt(sizeMatch[1], 10) : undefined };
      inHeader = false;
      continue;
    }

    if (!current) continue;

    if (line.startsWith("From:")) {
      current.from = line.replace(/^From:\s*/i, "").trim();
      inHeader = true;
    } else if (line.startsWith("Subject:")) {
      current.subject = decodeQuotedPrintable(line.replace(/^Subject:\s*/i, "").trim());
      inHeader = true;
    } else if (line.startsWith("Date:")) {
      current.date = line.replace(/^Date:\s*/i, "").trim();
      inHeader = true;
    } else if (line.startsWith(")") || line === "") {
      inHeader = false;
    }
  }

  if (current && current.uid) {
    messages.push(finalize(current));
  }

  return messages;
}

function finalize(m: Partial<ImapMessage>): ImapMessage {
  return {
    uid: m.uid ?? 0,
    from: m.from ?? "(unknown)",
    subject: m.subject ?? "(no subject)",
    date: m.date ?? "(unknown date)",
    preview: m.preview ?? "",
    size: m.size,
  };
}

function decodeQuotedPrintable(s: string): string {
  // Basic =?UTF-8?Q?...?= decoder
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_m, _charset, enc, encoded) => {
    if (enc.toUpperCase() === "B") {
      return Buffer.from(encoded, "base64").toString("utf-8");
    }
    return encoded.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );
  });
}

// ---------------------------------------------------------------------------
// Resolve IMAP config
// ---------------------------------------------------------------------------

function resolveConfig(args: EmailReaderArgs): ImapConfig | null {
  const host = args.imap_host ?? process.env.IMAP_HOST ?? "";
  const port = args.imap_port ?? parseInt(process.env.IMAP_PORT ?? "993", 10);
  const user = args.imap_user ?? process.env.IMAP_USER ?? "";
  const pass = args.imap_pass ?? process.env.IMAP_PASS ?? "";
  const secure =
    args.imap_secure !== undefined ? args.imap_secure : process.env.IMAP_SECURE !== "false";

  if (!host || !user || !pass) return null;
  return { host, port, user, pass, secure };
}

function setupInstructions(): string {
  return [
    "IMAP credentials are not configured.",
    "",
    "Set these environment variables to enable email reading:",
    "  IMAP_HOST=imap.gmail.com",
    "  IMAP_PORT=993",
    "  IMAP_USER=your@email.com",
    "  IMAP_PASS=your-app-password",
    "  IMAP_SECURE=true  (false for port 143 / STARTTLS)",
    "",
    "Or pass imap_host, imap_port, imap_user, imap_pass directly as arguments.",
    "",
    "Common IMAP servers:",
    "  Gmail:   imap.gmail.com:993  (requires App Password)",
    "  Outlook: outlook.office365.com:993",
    "  Yahoo:   imap.mail.yahoo.com:993",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export class EmailReaderSkill extends BaseSkill {
  name = "email-reader";
  description =
    "Read emails via IMAP. Can list mailboxes, list recent messages with subject/from/date, and read full message body. Credentials from IMAP_HOST/IMAP_PORT/IMAP_USER/IMAP_PASS env vars.";
  category = "communication";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["list_mailboxes", "list_messages", "read_message"],
        description:
          "Action: list_mailboxes (show all folders), list_messages (recent emails in a folder), read_message (full body by UID).",
      },
      folder: {
        type: "string",
        description: 'Mailbox folder name. Default: "INBOX". Used by list_messages.',
      },
      limit: {
        type: "number",
        description: "Max number of messages to return for list_messages. Default: 10.",
      },
      uid: {
        type: "number",
        description: "Message UID for read_message action.",
      },
      imap_host: {
        type: "string",
        description: "IMAP server hostname. Falls back to IMAP_HOST env var.",
      },
      imap_port: {
        type: "number",
        description: "IMAP port (993 for TLS, 143 for STARTTLS). Falls back to IMAP_PORT env var.",
      },
      imap_user: {
        type: "string",
        description: "IMAP username. Falls back to IMAP_USER env var.",
      },
      imap_pass: {
        type: "string",
        description: "IMAP password or app password. Falls back to IMAP_PASS env var.",
      },
      imap_secure: {
        type: "boolean",
        description: "Use implicit TLS. Falls back to IMAP_SECURE env var (default: true).",
      },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const typedArgs = args as unknown as EmailReaderArgs;
    const { action, folder = "INBOX", limit = 10, uid } = typedArgs;

    const cfg = resolveConfig(typedArgs);
    if (!cfg) return setupInstructions();

    logger.info(`[EmailReader] action=${action}, folder=${folder} (user: ${context.userId})`);

    const client = new ImapClient(cfg);

    try {
      await client.connect();
      await client.login();

      switch (action) {
        case "list_mailboxes": {
          const boxes = await client.listMailboxes();
          await client.logout();
          if (boxes.length === 0) return "No mailboxes found.";
          return ["Mailboxes:", ...boxes.map((b) => `  - ${b}`)].join("\n");
        }

        case "list_messages": {
          await client.selectFolder(folder);
          const ids = await client.searchAll(limit);
          if (ids.length === 0) {
            await client.logout();
            return `No messages found in "${folder}".`;
          }
          const messages = await client.fetchHeaders(ids);
          await client.logout();

          const lines = [
            `Messages in "${folder}" (${messages.length} shown):`,
            "",
          ];
          for (const msg of messages) {
            lines.push(`UID: ${msg.uid}`);
            lines.push(`  From:    ${msg.from}`);
            lines.push(`  Subject: ${msg.subject}`);
            lines.push(`  Date:    ${msg.date}`);
            if (msg.size) lines.push(`  Size:    ${(msg.size / 1024).toFixed(1)} KB`);
            lines.push("");
          }
          return lines.join("\n").trimEnd();
        }

        case "read_message": {
          if (!uid) throw new SkillError("uid is required for action=read_message");
          await client.selectFolder(folder);
          const body = await client.fetchBody(uid);
          await client.logout();
          const preview = body.length > 4000 ? body.slice(0, 4000) + "\n\n... [truncated]" : body;
          return [`=== Message UID ${uid} ===`, "", preview].join("\n");
        }

        default:
          await client.logout();
          throw new SkillError(`Unknown action: ${action}`);
      }
    } catch (err: unknown) {
      try { await client.logout(); } catch { /* ignore */ }
      const msg = err instanceof SkillError ? err.message : (err instanceof Error ? err.message : String(err));
      throw new SkillError(`IMAP error: ${msg}`);
    }
  }
}
