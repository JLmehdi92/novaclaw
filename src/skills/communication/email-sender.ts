// src/skills/communication/email-sender.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import * as net from "net";
import * as tls from "tls";

// ---------------------------------------------------------------------------
// Minimal SMTP client using Node's built-in net/tls modules
// Supports plaintext (port 25/587) with optional STARTTLS, and implicit TLS (port 465)
// ---------------------------------------------------------------------------

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean; // true = implicit TLS (port 465), false = STARTTLS or plain
}

interface EmailArgs {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string | string[];
  bcc?: string | string[];
  html?: boolean;
  // SMTP overrides (fall back to env vars if absent)
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_secure?: boolean;
}

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function buildRawMessage(
  from: string,
  to: string[],
  cc: string[],
  subject: string,
  body: string,
  isHtml: boolean
): string {
  const boundary = `----=_Part_${Date.now()}`;
  const contentType = isHtml ? `text/html; charset=UTF-8` : `text/plain; charset=UTF-8`;
  const date = new Date().toUTCString();

  const headers = [
    `Date: ${date}`,
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
  ].join("\r\n");

  void boundary; // suppress unused warning — boundary reserved for future multipart
  return headers;
}

async function sendSmtp(config: SmtpConfig, raw: string, from: string, recipients: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const lines = raw.split("\r\n");
    let lineIdx = 0;
    let socket: net.Socket;
    let tlsSocket: tls.TLSSocket | null = null;

    const getSocket = (): net.Socket => (tlsSocket as unknown as net.Socket) ?? socket;

    const sendLine = (cmd: string) => {
      logger.debug(`[EmailSender] >>> ${cmd}`);
      getSocket().write(cmd + "\r\n");
    };

    const sendData = () => {
      const dataSocket = getSocket();
      for (const line of lines) {
        // Dot-stuffing per RFC 5321
        const escaped = line.startsWith(".") ? "." + line : line;
        dataSocket.write(escaped + "\r\n");
      }
      dataSocket.write(".\r\n");
    };

    type State =
      | "greeting"
      | "ehlo"
      | "starttls"
      | "ehlo2"
      | "auth_login"
      | "auth_user"
      | "auth_pass"
      | "mail_from"
      | "rcpt_to"
      | "data"
      | "body"
      | "quit";

    let state: State = config.secure ? "greeting" : "greeting";
    let rcptIndex = 0;

    const handleLine = (line: string) => {
      logger.debug(`[EmailSender] <<< ${line}`);
      const code = parseInt(line.slice(0, 3), 10);
      const isLast = line[3] === " ";
      if (!isLast) return; // multiline response, wait for last line

      switch (state) {
        case "greeting":
          if (code !== 220) return reject(new Error(`SMTP greeting failed: ${line}`));
          state = "ehlo";
          sendLine(`EHLO novaclaw.local`);
          break;

        case "ehlo":
          if (code !== 250) return reject(new Error(`EHLO failed: ${line}`));
          if (!config.secure && !tlsSocket) {
            // Try STARTTLS
            state = "starttls";
            sendLine("STARTTLS");
          } else {
            state = "auth_login";
            sendLine("AUTH LOGIN");
          }
          break;

        case "starttls":
          if (code === 220) {
            // Upgrade to TLS
            tlsSocket = tls.connect({
              socket,
              host: config.host,
              rejectUnauthorized: false,
            });
            tlsSocket.once("secureConnect", () => {
              state = "ehlo2";
              sendLine(`EHLO novaclaw.local`);
            });
            tlsSocket.on("data", onData);
            tlsSocket.on("error", reject);
          } else {
            // STARTTLS not supported, continue without TLS
            state = "auth_login";
            sendLine("AUTH LOGIN");
          }
          break;

        case "ehlo2":
          if (code !== 250) return reject(new Error(`EHLO2 failed: ${line}`));
          state = "auth_login";
          sendLine("AUTH LOGIN");
          break;

        case "auth_login":
          if (code !== 334) return reject(new Error(`AUTH LOGIN failed: ${line}`));
          state = "auth_user";
          sendLine(Buffer.from(config.user).toString("base64"));
          break;

        case "auth_user":
          if (code !== 334) return reject(new Error(`AUTH user failed: ${line}`));
          state = "auth_pass";
          sendLine(Buffer.from(config.pass).toString("base64"));
          break;

        case "auth_pass":
          if (code !== 235) return reject(new Error(`AUTH failed (bad credentials?): ${line}`));
          state = "mail_from";
          sendLine(`MAIL FROM:<${from}>`);
          break;

        case "mail_from":
          if (code !== 250) return reject(new Error(`MAIL FROM failed: ${line}`));
          state = "rcpt_to";
          sendLine(`RCPT TO:<${recipients[rcptIndex]}>`);
          break;

        case "rcpt_to":
          if (code !== 250 && code !== 251) return reject(new Error(`RCPT TO failed: ${line}`));
          rcptIndex++;
          if (rcptIndex < recipients.length) {
            sendLine(`RCPT TO:<${recipients[rcptIndex]}>`);
          } else {
            state = "data";
            sendLine("DATA");
          }
          break;

        case "data":
          if (code !== 354) return reject(new Error(`DATA failed: ${line}`));
          state = "body";
          sendData();
          break;

        case "body":
          if (code !== 250) return reject(new Error(`Message rejected: ${line}`));
          state = "quit";
          sendLine("QUIT");
          break;

        case "quit":
          getSocket().destroy();
          resolve();
          break;
      }
    };

    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const parts = buffer.split("\r\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part) handleLine(part);
      }
    };

    const connectOpts = { host: config.host, port: config.port };

    if (config.secure) {
      tlsSocket = tls.connect({ ...connectOpts, rejectUnauthorized: false });
      socket = tlsSocket as unknown as net.Socket;
      tlsSocket.on("data", onData);
      tlsSocket.on("error", reject);
      tlsSocket.on("close", () => {
        if (lineIdx === 0) reject(new Error("Connection closed unexpectedly"));
      });
    } else {
      socket = net.connect(connectOpts);
      socket.on("data", onData);
      socket.on("error", reject);
      socket.on("close", () => {
        if (lineIdx === 0) reject(new Error("Connection closed unexpectedly"));
      });
    }

    void lineIdx; // used implicitly as sentinel
  });
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export class EmailSenderSkill extends BaseSkill {
  name = "email-sender";
  description =
    "Send emails via SMTP. Supports plain text and HTML bodies, CC/BCC recipients. SMTP credentials are read from environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE) or passed directly.";
  category = "communication";
  parameters = {
    type: "object" as const,
    properties: {
      to: {
        type: ["string", "array"],
        description: "Recipient email address(es). Single string or array of strings.",
      },
      subject: {
        type: "string",
        description: "Email subject line.",
      },
      body: {
        type: "string",
        description: "Email body content (plain text or HTML).",
      },
      cc: {
        type: ["string", "array"],
        description: "CC recipient(s). Optional.",
      },
      bcc: {
        type: ["string", "array"],
        description: "BCC recipient(s). Optional.",
      },
      html: {
        type: "boolean",
        description: "If true, body is treated as HTML. Default: false (plain text).",
      },
      smtp_host: {
        type: "string",
        description: "SMTP server hostname. Falls back to SMTP_HOST env var.",
      },
      smtp_port: {
        type: "number",
        description: "SMTP port (e.g. 587, 465, 25). Falls back to SMTP_PORT env var.",
      },
      smtp_user: {
        type: "string",
        description: "SMTP username / sender email. Falls back to SMTP_USER env var.",
      },
      smtp_pass: {
        type: "string",
        description: "SMTP password or app password. Falls back to SMTP_PASS env var.",
      },
      smtp_secure: {
        type: "boolean",
        description: "Use implicit TLS (port 465). Falls back to SMTP_SECURE env var.",
      },
    },
    required: ["to", "subject", "body"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const {
      to,
      subject,
      body,
      cc,
      bcc,
      html = false,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_secure,
    } = args as unknown as EmailArgs;

    if (!to || !subject || !body) {
      throw new SkillError("to, subject, and body are required");
    }

    // Resolve SMTP config from args or env vars
    const host = smtp_host ?? process.env.SMTP_HOST ?? "";
    const port = smtp_port ?? parseInt(process.env.SMTP_PORT ?? "587", 10);
    const user = smtp_user ?? process.env.SMTP_USER ?? "";
    const pass = smtp_pass ?? process.env.SMTP_PASS ?? "";
    const secure =
      smtp_secure !== undefined ? smtp_secure : process.env.SMTP_SECURE === "true";

    if (!host || !user || !pass) {
      return [
        "SMTP credentials are not configured.",
        "",
        "To use email-sender, set these environment variables:",
        "  SMTP_HOST=smtp.gmail.com",
        "  SMTP_PORT=587",
        "  SMTP_USER=your@email.com",
        "  SMTP_PASS=your-app-password",
        "  SMTP_SECURE=false  (true for port 465 / implicit TLS)",
        "",
        "Or pass smtp_host, smtp_port, smtp_user, smtp_pass directly as arguments.",
        "",
        "For Gmail: use an App Password (https://support.google.com/accounts/answer/185833)",
        "For Outlook/Hotmail: SMTP_HOST=smtp-mail.outlook.com, SMTP_PORT=587",
        "For custom SMTP: contact your provider for connection details.",
      ].join("\n");
    }

    const toList = toArray(to as string | string[]);
    const ccList = toArray(cc as string | string[] | undefined);
    const bccList = toArray(bcc as string | string[] | undefined);

    if (toList.length === 0) {
      throw new SkillError("At least one recipient (to) is required");
    }

    const config: SmtpConfig = { host, port, user, pass, secure };
    const allRecipients = [...toList, ...ccList, ...bccList];
    const raw = buildRawMessage(user, toList, ccList, subject, body, html as boolean);

    logger.info(`[EmailSender] Sending to ${allRecipients.join(", ")} via ${host}:${port} (user: ${context.userId})`);

    try {
      await sendSmtp(config, raw, user, allRecipients);

      return [
        "Email sent successfully.",
        `  From: ${user}`,
        `  To: ${toList.join(", ")}`,
        ...(ccList.length ? [`  CC: ${ccList.join(", ")}`] : []),
        ...(bccList.length ? [`  BCC: ${bccList.join(", ")}`] : []),
        `  Subject: ${subject}`,
        `  Format: ${html ? "HTML" : "Plain text"}`,
      ].join("\n");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new SkillError(`Failed to send email: ${msg}`);
    }
  }
}
