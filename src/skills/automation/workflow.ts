// src/skills/automation/workflow.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Workflow definitions
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  skill: string;
  tool: string;
  args: Record<string, unknown>;
  /** Optional: skip this step based on the previous step's result text */
  condition?: {
    /** Skip this step if the previous result contains this substring */
    skip_if_contains?: string;
    /** Skip this step if the previous result does NOT contain this substring */
    skip_if_not_contains?: string;
  };
  /** Human-readable label for the step */
  label?: string;
}

export interface Workflow {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  createdAt: string;
  runCount: number;
  lastRunAt?: string;
}

// Session-based in-memory store
const workflows: Map<string, Workflow> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepLabel(step: WorkflowStep): string {
  return step.label ? ` "${step.label}"` : "";
}

function conditionSummary(step: WorkflowStep): string {
  if (!step.condition) return "";
  if (step.condition.skip_if_contains)
    return ` [skip if contains: "${step.condition.skip_if_contains}"]`;
  if (step.condition.skip_if_not_contains)
    return ` [skip unless contains: "${step.condition.skip_if_not_contains}"]`;
  return "";
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

type WorkflowAction =
  | "create_workflow"
  | "list_workflows"
  | "run_workflow"
  | "delete_workflow";

interface WorkflowArgs {
  action: WorkflowAction;
  name?: string;
  description?: string;
  steps?: WorkflowStep[];
}

export class WorkflowSkill extends BaseSkill {
  name = "workflow";
  description =
    "Define and execute multi-step workflows that chain multiple skill actions together. " +
    "Supports conditional step skipping based on previous step results. " +
    "Workflows are stored in memory for the current session.";
  category = "automation";

  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["create_workflow", "list_workflows", "run_workflow", "delete_workflow"],
        description:
          "create_workflow: define a new workflow with a name and ordered steps. " +
          "list_workflows: show all saved workflows with their step summaries. " +
          "run_workflow: execute all steps of a named workflow sequentially. " +
          "delete_workflow: remove a workflow from memory.",
      },
      name: {
        type: "string",
        description:
          "Workflow name. Required for create_workflow, run_workflow, delete_workflow.",
      },
      description: {
        type: "string",
        description: "Optional description of what the workflow does.",
      },
      steps: {
        type: "array",
        description:
          "Array of workflow steps for create_workflow. " +
          "Each step: { skill, tool, args, label?, condition?: { skip_if_contains?, skip_if_not_contains? } }",
        items: {
          type: "object",
          properties: {
            skill: {
              type: "string",
              description: "Name of the skill to invoke.",
            },
            tool: {
              type: "string",
              description: "Action/tool name within the skill (passed as 'action' arg).",
            },
            args: {
              type: "object",
              description: "Arguments to pass to the skill action.",
            },
            label: {
              type: "string",
              description: "Optional human-readable label for this step.",
            },
            condition: {
              type: "object",
              description:
                "Optional condition to skip this step based on the previous step output.",
              properties: {
                skip_if_contains: {
                  type: "string",
                  description:
                    "Skip this step if the previous step result contains this substring.",
                },
                skip_if_not_contains: {
                  type: "string",
                  description:
                    "Skip this step if the previous step result does NOT contain this substring.",
                },
              },
            },
          },
          required: ["skill", "tool", "args"],
        },
      },
    },
    required: ["action"],
  };

  async execute(
    args: Record<string, unknown>,
    context: SkillContext
  ): Promise<string> {
    const typedArgs = args as unknown as WorkflowArgs;
    const { action } = typedArgs;

    logger.info(`[Workflow] action=${action} (user: ${context.userId})`);

    switch (action) {
      case "create_workflow":
        return this.createWorkflow(typedArgs);

      case "list_workflows":
        return this.listWorkflows();

      case "run_workflow":
        if (!typedArgs.name)
          throw new SkillError("name is required for run_workflow");
        return this.runWorkflow(typedArgs.name, context);

      case "delete_workflow":
        if (!typedArgs.name)
          throw new SkillError("name is required for delete_workflow");
        return this.deleteWorkflow(typedArgs.name);

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private createWorkflow(args: WorkflowArgs): string {
    if (!args.name)
      throw new SkillError("name is required for create_workflow");
    if (!args.steps || args.steps.length === 0)
      throw new SkillError(
        "steps array is required and must not be empty for create_workflow"
      );

    // Validate steps
    for (let i = 0; i < args.steps.length; i++) {
      const step = args.steps[i];
      if (!step.skill)
        throw new SkillError(`Step ${i + 1}: 'skill' is required`);
      if (!step.tool)
        throw new SkillError(`Step ${i + 1}: 'tool' is required`);
      if (!step.args || typeof step.args !== "object")
        throw new SkillError(`Step ${i + 1}: 'args' must be an object`);
    }

    if (workflows.has(args.name)) {
      return [
        `Workflow "${args.name}" already exists.`,
        "Delete it first with delete_workflow before recreating.",
      ].join("\n");
    }

    const workflow: Workflow = {
      name: args.name,
      description: args.description,
      steps: args.steps,
      createdAt: new Date().toISOString(),
      runCount: 0,
    };

    workflows.set(workflow.name, workflow);

    const lines: string[] = [
      `Workflow "${workflow.name}" created with ${workflow.steps.length} step(s).`,
      "",
    ];

    if (workflow.description) {
      lines.push(`Description: ${workflow.description}`, "");
    }

    lines.push("Steps:");
    for (let i = 0; i < workflow.steps.length; i++) {
      const s = workflow.steps[i];
      lines.push(`  ${i + 1}.${stepLabel(s)} ${s.skill}.${s.tool}`);
      if (s.condition?.skip_if_contains) {
        lines.push(
          `     Skip if previous result contains: "${s.condition.skip_if_contains}"`
        );
      }
      if (s.condition?.skip_if_not_contains) {
        lines.push(
          `     Skip if previous result does NOT contain: "${s.condition.skip_if_not_contains}"`
        );
      }
    }

    lines.push("", `Use run_workflow with name="${workflow.name}" to execute it.`);
    return lines.join("\n");
  }

  private listWorkflows(): string {
    if (workflows.size === 0) {
      return [
        "No workflows defined.",
        "",
        "Create a workflow with create_workflow:",
        '  { action: "create_workflow", name: "my-workflow", steps: [...] }',
        "",
        "Each step: { skill, tool, args, label?, condition? }",
      ].join("\n");
    }

    const lines: string[] = [`Workflows (${workflows.size}):`, ""];

    for (const wf of workflows.values()) {
      lines.push(`Name: ${wf.name}`);
      if (wf.description) lines.push(`  Description: ${wf.description}`);
      lines.push(`  Steps: ${wf.steps.length}`);
      lines.push(`  Created: ${wf.createdAt}`);
      lines.push(
        `  Runs: ${wf.runCount}${
          wf.lastRunAt ? ` (last: ${wf.lastRunAt})` : ""
        }`
      );
      lines.push("  Step summary:");
      for (let i = 0; i < wf.steps.length; i++) {
        const s = wf.steps[i];
        lines.push(
          `    ${i + 1}.${stepLabel(s)} ${s.skill}.${s.tool}${conditionSummary(s)}`
        );
      }
      lines.push("");
    }

    return lines.join("\n").trimEnd();
  }

  private async runWorkflow(
    name: string,
    context: SkillContext
  ): Promise<string> {
    const workflow = workflows.get(name);
    if (!workflow) {
      throw new SkillError(
        `Workflow "${name}" not found. Use list_workflows to see available workflows.`
      );
    }

    const lines: string[] = [
      `Running workflow: "${name}" (${workflow.steps.length} step(s))`,
    ];
    if (workflow.description) lines.push(`Description: ${workflow.description}`);
    lines.push("");

    // Load skill registry dynamically
    let registry: { get: (skillName: string) => BaseSkill | undefined } | null =
      null;
    try {
      const { SkillsRegistry } = await import("../registry.js");
      registry = SkillsRegistry;
    } catch {
      lines.push("Registry unavailable — showing workflow steps only:");
      lines.push("");
      for (let i = 0; i < workflow.steps.length; i++) {
        const s = workflow.steps[i];
        lines.push(
          `  Step ${i + 1}:${stepLabel(s)} ${s.skill}.${s.tool}(${JSON.stringify(s.args)})`
        );
      }
      return lines.join("\n");
    }

    let previousResult = "";
    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const total = workflow.steps.length;

    for (let i = 0; i < total; i++) {
      const step = workflow.steps[i];
      const stepNum = i + 1;

      lines.push(`Step ${stepNum}/${total}:${stepLabel(step)} ${step.skill}.${step.tool}`);

      // Evaluate skip condition against previous step's result
      if (step.condition && i > 0) {
        const { skip_if_contains, skip_if_not_contains } = step.condition;

        if (
          skip_if_contains !== undefined &&
          previousResult.includes(skip_if_contains)
        ) {
          lines.push(
            `  [SKIP] Condition: previous result contains "${skip_if_contains}"`
          );
          skippedCount++;
          continue;
        }

        if (
          skip_if_not_contains !== undefined &&
          !previousResult.includes(skip_if_not_contains)
        ) {
          lines.push(
            `  [SKIP] Condition: previous result does not contain "${skip_if_not_contains}"`
          );
          skippedCount++;
          continue;
        }
      }

      const skill = registry.get(step.skill);
      if (!skill) {
        const msg = `Skill "${step.skill}" not registered`;
        lines.push(`  [SKIP] ${msg}`);
        previousResult = `SKIP: ${msg}`;
        skippedCount++;
        continue;
      }

      try {
        // Pass tool name as the "action" parameter for skills that use action-based dispatch
        const stepArgs: Record<string, unknown> = { ...step.args, action: step.tool };
        const result = await skill.execute(stepArgs, context);
        previousResult = result;
        executedCount++;
        const preview =
          result.length > 300 ? result.slice(0, 300) + "…" : result;
        lines.push(`  [OK] ${preview}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        previousResult = `ERROR: ${msg}`;
        lines.push(`  [ERROR] ${msg}`);
        errorCount++;
      }

      lines.push("");
    }

    // Update stats
    workflow.runCount++;
    workflow.lastRunAt = new Date().toISOString();
    workflows.set(name, workflow);

    const summaryParts = [
      `Workflow "${name}" completed.`,
      `  Total: ${total}  |  Executed: ${executedCount}`,
    ];
    if (skippedCount > 0) summaryParts.push(`  Skipped: ${skippedCount}`);
    if (errorCount > 0) summaryParts.push(`  Errors: ${errorCount}`);
    summaryParts.push(`  Run #${workflow.runCount}`);

    lines.push(summaryParts.join("\n"));
    return lines.join("\n");
  }

  private deleteWorkflow(name: string): string {
    if (!workflows.has(name)) {
      throw new SkillError(
        `Workflow "${name}" not found. Use list_workflows to see available workflows.`
      );
    }

    workflows.delete(name);
    return `Workflow "${name}" deleted. ${workflows.size} workflow(s) remaining.`;
  }
}
