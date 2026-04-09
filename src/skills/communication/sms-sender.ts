// src/skills/communication/sms-sender.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Twilio REST API implementation using Node's built-in fetch
// API reference: https://www.twilio.com/docs/sms/api
// ---------------------------------------------------------------------------

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string; // Twilio phone number in E.164 format, e.g. +1234567890
}

interface SmsSenderArgs {
  to: string;
  message: string;
  // Optional Twilio credential overrides (fall back to env vars)
  twilio_sid?: string;
  twilio_token?: string;
  twilio_from?: string;
}

interface TwilioResponse {
  sid?: string;
  status?: string;
  error_code?: number | null;
  error_message?: string | null;
  to?: string;
  from?: string;
  body?: string;
  date_created?: string;
  price?: string;
  price_unit?: string;
  message?: string; // error message field
  code?: number;    // Twilio error code
}

function resolveConfig(args: SmsSenderArgs): TwilioConfig | null {
  const accountSid = args.twilio_sid ?? process.env.TWILIO_ACCOUNT_SID ?? "";
  const authToken = args.twilio_token ?? process.env.TWILIO_AUTH_TOKEN ?? "";
  const fromNumber = args.twilio_from ?? process.env.TWILIO_FROM_NUMBER ?? "";

  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

function setupInstructions(): string {
  return [
    "Twilio credentials are not configured.",
    "",
    "To enable SMS sending, set these environment variables:",
    "  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "  TWILIO_AUTH_TOKEN=your_auth_token",
    "  TWILIO_FROM_NUMBER=+1234567890   (your Twilio phone number)",
    "",
    "Or pass twilio_sid, twilio_token, twilio_from directly as arguments.",
    "",
    "Setup steps:",
    "  1. Create a free account at https://www.twilio.com/try-twilio",
    "  2. Get a Twilio phone number (free trial includes one)",
    "  3. Find your Account SID and Auth Token in the Twilio Console",
    "  4. Set the environment variables above",
    "",
    "Note: Free trial accounts can only send to verified phone numbers.",
    "Phone numbers must be in E.164 format: +[country code][number] (e.g. +14155552671)",
  ].join("\n");
}

function validatePhoneNumber(phone: string): void {
  // Basic E.164 validation
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new SkillError(
      `Invalid phone number format: "${phone}". Use E.164 format (e.g. +14155552671).`
    );
  }
}

async function sendTwilioSms(
  cfg: TwilioConfig,
  to: string,
  message: string
): Promise<TwilioResponse> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;

  const body = new URLSearchParams({
    To: to,
    From: cfg.fromNumber,
    Body: message,
  });

  const credentials = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = (await response.json()) as TwilioResponse;

  if (!response.ok) {
    const errMsg = data.message ?? data.error_message ?? "Unknown Twilio error";
    const errCode = data.code ?? data.error_code ?? response.status;
    throw new SkillError(`Twilio API error ${errCode}: ${errMsg}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export class SmsSenderSkill extends BaseSkill {
  name = "sms-sender";
  description =
    "Send SMS messages via Twilio REST API. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables (or pass as arguments).";
  category = "communication";
  parameters = {
    type: "object" as const,
    properties: {
      to: {
        type: "string",
        description: "Recipient phone number in E.164 format (e.g. +14155552671).",
      },
      message: {
        type: "string",
        description: "SMS message text. Max 1600 characters (long SMS auto-split by Twilio).",
      },
      twilio_sid: {
        type: "string",
        description: "Twilio Account SID. Falls back to TWILIO_ACCOUNT_SID env var.",
      },
      twilio_token: {
        type: "string",
        description: "Twilio Auth Token. Falls back to TWILIO_AUTH_TOKEN env var.",
      },
      twilio_from: {
        type: "string",
        description: "Twilio sender phone number (E.164). Falls back to TWILIO_FROM_NUMBER env var.",
      },
    },
    required: ["to", "message"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const typedArgs = args as unknown as SmsSenderArgs;
    const { to, message } = typedArgs;

    if (!to) throw new SkillError("to (phone number) is required");
    if (!message) throw new SkillError("message is required");
    if (message.length > 1600) throw new SkillError("Message exceeds 1600 characters");

    validatePhoneNumber(to);

    const cfg = resolveConfig(typedArgs);
    if (!cfg) return setupInstructions();

    logger.info(`[SmsSender] Sending SMS to ${to} via Twilio (user: ${context.userId})`);

    try {
      const result = await sendTwilioSms(cfg, to, message);

      const lines = [
        "SMS sent successfully.",
        `  SID:     ${result.sid ?? "N/A"}`,
        `  Status:  ${result.status ?? "N/A"}`,
        `  To:      ${result.to ?? to}`,
        `  From:    ${result.from ?? cfg.fromNumber}`,
        `  Created: ${result.date_created ?? new Date().toISOString()}`,
      ];

      if (result.price && result.price_unit) {
        lines.push(`  Cost:    ${result.price} ${result.price_unit}`);
      }

      return lines.join("\n");
    } catch (err: unknown) {
      if (err instanceof SkillError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new SkillError(`Failed to send SMS: ${msg}`);
    }
  }
}
