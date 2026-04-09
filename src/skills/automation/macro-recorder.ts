// src/skills/automation/macro-recorder.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ---------------------------------------------------------------------------
// Macro storage (in-memory + optional file persistence)
// ---------------------------------------------------------------------------

export interface MacroStep {
  skill: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface Macro {
  name: string;
  description?: string;
  steps: MacroStep[];
  createdAt: string;
  lastPlayedAt?: string;
  playCount: number;
}

// Session-based in-memory store
const macros: Map<string, Macro> = new Map();

// Active recording state
interface RecordingSession {
  name: string;
  description?: string;
  steps: MacroStep[];
  startedAt: string;
}

let activeRecording: RecordingSession | null = null;

function getMacroFilePath(): string {
  const configDir = process.env.NOVACLAW_CONFIG_DIR
    ?? path.join(os.homedir(), ".novaclaw");
  return path.join(configDir, "macros.json");
}

function loadFromFile(): void {
  try {
    const filePath = getMacroFilePath();
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Record<string, Macro>;
    for (const [name, macro] of Object.entries(data)) {
      macros.set(name, macro);
    }
  } catch {
    // File may not exist or may be malformed — skip
  }
}

function saveToFile(): void {
  try {
    const filePath = getMacroFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data: Record<string, Macro> = {};
    for (const [name, macro] of macros.entries()) {
      data[name] = macro;
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Silently skip file persistence errors
  }
}

// Load persisted macros on module init
loadFromFile();

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

type MacroAction =
  | "start_recording"
  | "stop_recording"
  | "list_macros"
  | "play_macro"
  | "delete_macro";

interface MacroArgs {
  action: MacroAction;
  name?: string;
  description?: string;
  // For manually adding a step during recording
  skill?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export class MacroRecorderSkill extends BaseSkill {
  name = "macro-recorder";
  description =
    "Record and replay sequences of skill actions as macros. Start a recording session, stop it to save, then play it back later. Macros are persisted to disk in ~/.novaclaw/macros.json.";
  category = "automation";

  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: [
          "start_recording",
          "stop_recording",
          "list_macros",
          "play_macro",
          "delete_macro",
        ],
        description:
          "start_recording: begin capturing steps into a named macro. " +
          "stop_recording: finalize and save the current recording. " +
          "list_macros: show all saved macros. " +
          "play_macro: execute all steps in a saved macro. " +
          "delete_macro: remove a saved macro.",
      },
      name: {
        type: "string",
        description: "Macro name. Required for start_recording, play_macro, delete_macro.",
      },
      description: {
        type: "string",
        description: "Optional description for the macro (used in start_recording).",
      },
      skill: {
        type: "string",
        description:
          "Skill name to add as a step when stop_recording is called with a manual step. " +
          "Also used when specifying steps inline.",
      },
      tool: {
        type: "string",
        description: "Tool/action name within the skill to record as a step.",
      },
      args: {
        type: "object",
        description: "Arguments for the step being recorded.",
      },
    },
    required: ["action"],
  };

  async execute(
    args: Record<string, unknown>,
    context: SkillContext
  ): Promise<string> {
    const typedArgs = args as unknown as MacroArgs;
    const { action } = typedArgs;

    logger.info(`[MacroRecorder] action=${action} (user: ${context.userId})`);

    switch (action) {
      case "start_recording":
        return this.startRecording(typedArgs);

      case "stop_recording":
        return this.stopRecording(typedArgs);

      case "list_macros":
        return this.listMacros();

      case "play_macro":
        if (!typedArgs.name)
          throw new SkillError("name is required for play_macro");
        return this.playMacro(typedArgs.name, context);

      case "delete_macro":
        if (!typedArgs.name)
          throw new SkillError("name is required for delete_macro");
        return this.deleteMacro(typedArgs.name);

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private startRecording(args: MacroArgs): string {
    if (!args.name) throw new SkillError("name is required for start_recording");

    if (activeRecording) {
      return [
        `Already recording macro "${activeRecording.name}" (started ${activeRecording.startedAt}).`,
        "Call stop_recording first to save or discard it before starting a new one.",
      ].join("\n");
    }

    activeRecording = {
      name: args.name,
      description: args.description,
      steps: [],
      startedAt: new Date().toISOString(),
    };

    return [
      `Recording started for macro: "${args.name}"`,
      args.description ? `Description: ${args.description}` : "",
      "",
      "To add steps to this macro, call stop_recording with skill, tool, and args parameters.",
      "Or use the workflow skill to define structured multi-step workflows.",
      "",
      "Call stop_recording when done to save the macro.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private stopRecording(args: MacroArgs): string {
    if (!activeRecording) {
      return "No active recording session. Call start_recording first.";
    }

    // If a step is provided inline, add it before saving
    if (args.skill && args.tool) {
      activeRecording.steps.push({
        skill: args.skill,
        tool: args.tool,
        args: args.args ?? {},
      });
    }

    const macro: Macro = {
      name: activeRecording.name,
      description: activeRecording.description,
      steps: activeRecording.steps,
      createdAt: activeRecording.startedAt,
      playCount: 0,
    };

    macros.set(macro.name, macro);
    saveToFile();

    const name = activeRecording.name;
    const stepCount = activeRecording.steps.length;
    activeRecording = null;

    return [
      `Macro "${name}" saved with ${stepCount} step(s).`,
      "",
      stepCount === 0
        ? "Note: The macro has no steps. Add steps by calling play_macro with a skill/tool combination."
        : `Steps: ${macro.steps.map((s, i) => `${i + 1}. ${s.skill}.${s.tool}`).join(", ")}`,
      "",
      `Use play_macro with name="${name}" to execute it.`,
    ].join("\n");
  }

  private listMacros(): string {
    if (macros.size === 0) {
      return [
        "No macros saved.",
        "",
        "To create a macro:",
        "  1. Call start_recording with a name",
        "  2. Call stop_recording to save",
        "  3. Use play_macro to replay",
      ].join("\n");
    }

    const lines = [`Saved macros (${macros.size}):`, ""];

    for (const macro of macros.values()) {
      lines.push(`Name: ${macro.name}`);
      if (macro.description) lines.push(`  Description: ${macro.description}`);
      lines.push(`  Steps: ${macro.steps.length}`);
      lines.push(`  Created: ${macro.createdAt}`);
      lines.push(`  Played: ${macro.playCount} time(s)${macro.lastPlayedAt ? ` (last: ${macro.lastPlayedAt})` : ""}`);

      if (macro.steps.length > 0) {
        lines.push(`  Step list:`);
        for (let i = 0; i < macro.steps.length; i++) {
          const s = macro.steps[i];
          lines.push(`    ${i + 1}. ${s.skill}.${s.tool}(${JSON.stringify(s.args)})`);
        }
      }
      lines.push("");
    }

    if (activeRecording) {
      lines.push(
        `[Active recording: "${activeRecording.name}" — ${activeRecording.steps.length} step(s) captured so far]`
      );
    }

    return lines.join("\n").trimEnd();
  }

  private async playMacro(name: string, context: SkillContext): Promise<string> {
    const macro = macros.get(name);
    if (!macro) {
      throw new SkillError(
        `Macro "${name}" not found. Use list_macros to see available macros.`
      );
    }

    if (macro.steps.length === 0) {
      return `Macro "${name}" has no steps to execute.`;
    }

    const lines = [`Playing macro: "${name}" (${macro.steps.length} step(s))`, ""];
    const results: string[] = [];

    // Dynamically import the skill registry to execute steps
    let registry: { get: (name: string) => BaseSkill | undefined } | null = null;
    try {
      const { SkillsRegistry } = await import("../registry.js");
      registry = SkillsRegistry;
    } catch {
      return [
        `Macro "${name}" steps (simulation — registry unavailable):`,
        "",
        ...macro.steps.map(
          (s, i) => `  Step ${i + 1}: ${s.skill}.${s.tool}(${JSON.stringify(s.args)})`
        ),
      ].join("\n");
    }

    for (let i = 0; i < macro.steps.length; i++) {
      const step = macro.steps[i];
      lines.push(`Step ${i + 1}: ${step.skill}.${step.tool}`);

      const skill = registry.get(step.skill);
      if (!skill) {
        const msg = `Skill "${step.skill}" not found — skipped`;
        lines.push(`  [SKIP] ${msg}`);
        results.push(msg);
        continue;
      }

      try {
        // Execute the step via the skill's execute method, passing tool as the action
        const stepArgs = { ...step.args, action: step.tool };
        const result = await skill.execute(stepArgs, context);
        const truncated =
          result.length > 200 ? result.slice(0, 200) + "…" : result;
        lines.push(`  [OK] ${truncated}`);
        results.push(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lines.push(`  [ERROR] ${msg}`);
        results.push(`ERROR: ${msg}`);
      }
    }

    // Update play stats
    macro.playCount++;
    macro.lastPlayedAt = new Date().toISOString();
    macros.set(name, macro);
    saveToFile();

    lines.push("");
    lines.push(`Macro "${name}" completed. ${macro.playCount} total play(s).`);

    return lines.join("\n");
  }

  private deleteMacro(name: string): string {
    if (!macros.has(name)) {
      throw new SkillError(
        `Macro "${name}" not found. Use list_macros to see available macros.`
      );
    }

    macros.delete(name);
    saveToFile();

    return `Macro "${name}" deleted successfully. ${macros.size} macro(s) remaining.`;
  }

  // Public method to allow other parts of the system to add steps to the active recording
  static addStep(step: MacroStep): boolean {
    if (!activeRecording) return false;
    activeRecording.steps.push(step);
    return true;
  }

  static isRecording(): boolean {
    return activeRecording !== null;
  }

  static getActiveRecordingName(): string | null {
    return activeRecording?.name ?? null;
  }
}
