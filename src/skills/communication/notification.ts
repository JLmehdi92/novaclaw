// src/skills/communication/notification.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Notification history (in-process session memory)
// ---------------------------------------------------------------------------

interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  icon?: string;
  sentAt: string;
  platform: string;
  status: "sent" | "failed";
  error?: string;
}

const notificationHistory: NotificationRecord[] = [];
let notificationCounter = 0;

// ---------------------------------------------------------------------------
// Platform detection and notification dispatchers
// ---------------------------------------------------------------------------

type Platform = "windows" | "macos" | "linux" | "unknown";

function detectPlatform(): Platform {
  switch (process.platform) {
    case "win32":  return "windows";
    case "darwin": return "macos";
    case "linux":  return "linux";
    default:       return "unknown";
  }
}

function escapePs(s: string): string {
  // Escape single quotes for PowerShell string context
  return s.replace(/'/g, "''");
}

function escapeSh(s: string): string {
  // Escape double quotes for shell use
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

async function notifyWindows(title: string, message: string, _icon?: string): Promise<void> {
  // Use PowerShell WinRT toast notification (Windows 10+)
  // Falls back to BurntToast-style raw XML if WinRT isn't available
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
$notify.ShowBalloonTip(5000, '${escapePs(title)}', '${escapePs(message)}', [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Milliseconds 500
$notify.Dispose()
`.trim();

  await execAsync(`powershell -NoProfile -NonInteractive -Command "${escapePs(ps)}"`, {
    timeout: 10000,
  });
}

async function notifyMacOs(title: string, message: string, _icon?: string): Promise<void> {
  // Use osascript (AppleScript) — available on all macOS versions
  const script = `display notification "${escapeSh(message)}" with title "${escapeSh(title)}"`;
  await execAsync(`osascript -e '${escapePs(script)}'`, { timeout: 10000 });
}

async function notifyLinux(title: string, message: string, icon?: string): Promise<void> {
  // Try notify-send (libnotify)
  const iconArg = icon ? `-i "${escapeSh(icon)}" ` : "";
  try {
    await execAsync(
      `notify-send ${iconArg}"${escapeSh(title)}" "${escapeSh(message)}"`,
      { timeout: 10000 }
    );
    return;
  } catch {
    // fallback: try zenity
  }

  try {
    await execAsync(
      `zenity --info --title="${escapeSh(title)}" --text="${escapeSh(message)}" --timeout=5`,
      { timeout: 10000 }
    );
  } catch {
    throw new Error("notify-send and zenity both failed. Install libnotify-bin: sudo apt install libnotify-bin");
  }
}

async function dispatchNotification(
  title: string,
  message: string,
  icon?: string
): Promise<{ platform: Platform; status: "sent" | "failed"; error?: string }> {
  const platform = detectPlatform();

  try {
    switch (platform) {
      case "windows":
        await notifyWindows(title, message, icon);
        break;
      case "macos":
        await notifyMacOs(title, message, icon);
        break;
      case "linux":
        await notifyLinux(title, message, icon);
        break;
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
    return { platform, status: "sent" };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { platform, status: "failed", error };
  }
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

type NotificationAction = "send_notification" | "list_recent";

interface NotificationArgs {
  action: NotificationAction;
  title?: string;
  message?: string;
  icon?: string;
  limit?: number;
}

export class NotificationSkill extends BaseSkill {
  name = "notification";
  description =
    "Send cross-platform system notifications (Windows toast via PowerShell, macOS via osascript, Linux via notify-send). Also tracks recent notifications sent in this session.";
  category = "communication";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["send_notification", "list_recent"],
        description:
          "Action: send_notification (display a system alert), list_recent (show last N notifications sent in this session).",
      },
      title: {
        type: "string",
        description: "Notification title. Required for send_notification.",
      },
      message: {
        type: "string",
        description: "Notification body/message. Required for send_notification.",
      },
      icon: {
        type: "string",
        description: "Optional icon path or name (used on Linux with notify-send -i).",
      },
      limit: {
        type: "number",
        description: "Max number of recent notifications to return for list_recent. Default: 10.",
      },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const typedArgs = args as unknown as NotificationArgs;
    const { action } = typedArgs;

    logger.info(`[Notification] action=${action} (user: ${context.userId})`);

    switch (action) {
      case "send_notification":
        return this.sendNotification(typedArgs, context);

      case "list_recent":
        return this.listRecent(typedArgs.limit ?? 10);

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private async sendNotification(
    args: NotificationArgs,
    context: SkillContext
  ): Promise<string> {
    const { title, message, icon } = args;

    if (!title) throw new SkillError("title is required for send_notification");
    if (!message) throw new SkillError("message is required for send_notification");
    if (title.length > 256) throw new SkillError("title exceeds 256 characters");
    if (message.length > 1024) throw new SkillError("message exceeds 1024 characters");

    logger.info(`[Notification] Sending: "${title}" (user: ${context.userId})`);

    const { platform, status, error } = await dispatchNotification(title, message, icon);

    const id = ++notificationCounter;
    const record: NotificationRecord = {
      id,
      title,
      message,
      icon,
      sentAt: new Date().toISOString(),
      platform,
      status,
      error,
    };
    notificationHistory.push(record);

    if (status === "failed") {
      return [
        `Notification failed on platform "${platform}".`,
        `Error: ${error}`,
        "",
        "Troubleshooting:",
        "  Windows: Ensure you are running in an interactive session with PowerShell available.",
        "  macOS:   Grant notification permissions in System Preferences > Notifications.",
        "  Linux:   Install libnotify-bin: sudo apt install libnotify-bin",
        "",
        `The notification has been logged with ID ${id}.`,
      ].join("\n");
    }

    return [
      `Notification sent successfully.`,
      `  ID:       ${id}`,
      `  Platform: ${platform}`,
      `  Title:    ${title}`,
      `  Message:  ${message}`,
      ...(icon ? [`  Icon:     ${icon}`] : []),
      `  Sent at:  ${record.sentAt}`,
    ].join("\n");
  }

  private listRecent(limit: number): string {
    if (notificationHistory.length === 0) {
      return "No notifications sent in this session.";
    }

    const recent = notificationHistory.slice(-Math.max(1, limit)).reverse();

    const lines = [`Recent notifications (${recent.length} of ${notificationHistory.length} total):`, ""];
    for (const n of recent) {
      lines.push(`[${n.id}] ${n.sentAt} — ${n.status.toUpperCase()}`);
      lines.push(`  Title:    ${n.title}`);
      lines.push(`  Message:  ${n.message}`);
      lines.push(`  Platform: ${n.platform}`);
      if (n.status === "failed" && n.error) {
        lines.push(`  Error:    ${n.error}`);
      }
      lines.push("");
    }

    return lines.join("\n").trimEnd();
  }
}
