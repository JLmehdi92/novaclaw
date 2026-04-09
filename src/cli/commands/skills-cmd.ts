// src/cli/commands/skills-cmd.ts
import { Command } from "commander";
import chalk from "chalk";
import {
  loadConfig,
  saveConfig,
  configExists,
  getEnabledSkills,
} from "../../config/loader.js";
import { NovaClawConfig } from "../../config/schema.js";
import { ALL_SKILLS, SKILL_CATEGORIES, SKILL_PRESETS } from "../../config/defaults.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireConfig(): ReturnType<typeof loadConfig> {
  if (!configExists()) {
    console.error(chalk.red("No configuration found. Run 'novaclaw setup' first."));
    process.exit(1);
  }
  return loadConfig();
}

function findSkill(name: string) {
  const skill = ALL_SKILLS.find(
    (s) => s.id === name || s.name.toLowerCase() === name.toLowerCase()
  );
  return skill;
}

// ---------------------------------------------------------------------------
// skills list
// ---------------------------------------------------------------------------

function skillsList(options: {
  enabled?: boolean;
  disabled?: boolean;
  category?: string;
}): void {
  const config = requireConfig();
  const enabledIds = new Set(getEnabledSkills(config));
  const totalEnabled = enabledIds.size;

  // Apply filters
  let skills = ALL_SKILLS.slice();
  if (options.category) {
    const cat = options.category.toLowerCase();
    skills = skills.filter((s) => s.category === cat);
    if (skills.length === 0) {
      const validCats = SKILL_CATEGORIES.map((c) => c.id).join(", ");
      console.error(chalk.red(`Unknown category '${options.category}'. Valid: ${validCats}`));
      process.exit(1);
    }
  }
  if (options.enabled && !options.disabled) {
    skills = skills.filter((s) => enabledIds.has(s.id));
  } else if (options.disabled && !options.enabled) {
    skills = skills.filter((s) => !enabledIds.has(s.id));
  }

  const BORDER = "═".repeat(59);
  console.log("\n" + chalk.cyan(BORDER));
  console.log(
    chalk.cyan(`  NovaClaw Skills (${ALL_SKILLS.length} total, ${totalEnabled} enabled)`)
  );
  console.log(chalk.cyan(BORDER));

  // Group skills by category for display
  const categoriesInView = options.category
    ? SKILL_CATEGORIES.filter((c) => c.id === options.category)
    : SKILL_CATEGORIES;

  for (const cat of categoriesInView) {
    const catSkills = skills.filter((s) => s.category === cat.id);
    if (catSkills.length === 0) continue;

    console.log(`\n${cat.icon} ${chalk.bold(cat.name)}`);
    for (const skill of catSkills) {
      const isEnabled = enabledIds.has(skill.id);
      const statusIcon = isEnabled ? chalk.green("✓") : chalk.red("✗");
      const nameStr = isEnabled
        ? chalk.green(skill.id.padEnd(18))
        : chalk.gray(skill.id.padEnd(18));
      const desc = chalk.gray(`- ${skill.description}`);
      console.log(`  ${statusIcon} ${nameStr} ${desc}`);
    }
  }

  console.log();
  const preset = config.skills?.preset ?? "standard";
  const presetCount = getEnabledSkills(config).length;
  console.log(chalk.gray(`Preset: ${chalk.cyan(preset)} (${presetCount} skills)`));
  console.log(chalk.gray("Use 'novaclaw skills enable <name>' to enable a skill"));
  console.log();
}

// ---------------------------------------------------------------------------
// skills enable
// ---------------------------------------------------------------------------

function skillsEnable(name: string): void {
  const config = requireConfig();
  const skill = findSkill(name);
  if (!skill) {
    console.error(chalk.red(`Unknown skill '${name}'. Use 'novaclaw skills list' to see available skills.`));
    process.exit(1);
  }

  const skills = config.skills ?? { preset: "standard", enabled: [], disabled: [], config: {} };
  const enabled = Array.isArray(skills.enabled) ? [...skills.enabled] : [];
  const disabled = Array.isArray(skills.disabled) ? [...skills.disabled] : [];

  // Remove from disabled if present
  const disabledIdx = disabled.indexOf(skill.id);
  if (disabledIdx !== -1) disabled.splice(disabledIdx, 1);

  // Add to enabled if not already there
  if (!enabled.includes(skill.id)) {
    enabled.push(skill.id);
  }

  const updatedConfig = {
    ...config,
    skills: { ...skills, enabled, disabled },
  };

  saveConfig(updatedConfig);

  const newEnabledCount = getEnabledSkills(updatedConfig).length;
  console.log(
    `${chalk.green("✓")} Skill ${chalk.cyan(skill.id)} ${chalk.bold("enabled")} ` +
    chalk.gray(`(${newEnabledCount} skills active)`)
  );
}

// ---------------------------------------------------------------------------
// skills disable
// ---------------------------------------------------------------------------

function skillsDisable(name: string): void {
  const config = requireConfig();
  const skill = findSkill(name);
  if (!skill) {
    console.error(chalk.red(`Unknown skill '${name}'. Use 'novaclaw skills list' to see available skills.`));
    process.exit(1);
  }

  const skills = config.skills ?? { preset: "standard", enabled: [], disabled: [], config: {} };
  const enabled = Array.isArray(skills.enabled) ? [...skills.enabled] : [];
  const disabled = Array.isArray(skills.disabled) ? [...skills.disabled] : [];

  // Remove from enabled if present
  const enabledIdx = enabled.indexOf(skill.id);
  if (enabledIdx !== -1) enabled.splice(enabledIdx, 1);

  // Add to disabled if not already there
  if (!disabled.includes(skill.id)) {
    disabled.push(skill.id);
  }

  const updatedConfig = {
    ...config,
    skills: { ...skills, enabled, disabled },
  };

  saveConfig(updatedConfig);

  const newEnabledCount = getEnabledSkills(updatedConfig).length;
  console.log(
    `${chalk.yellow("✗")} Skill ${chalk.cyan(skill.id)} ${chalk.bold("disabled")} ` +
    chalk.gray(`(${newEnabledCount} skills active)`)
  );
}

// ---------------------------------------------------------------------------
// skills info
// ---------------------------------------------------------------------------

function skillsInfo(name: string): void {
  const config = requireConfig();
  const skill = findSkill(name);
  if (!skill) {
    console.error(chalk.red(`Unknown skill '${name}'. Use 'novaclaw skills list' to see available skills.`));
    process.exit(1);
  }

  const enabledIds = new Set(getEnabledSkills(config));
  const isEnabled = enabledIds.has(skill.id);

  const cat = SKILL_CATEGORIES.find((c) => c.id === skill.category);
  const catDisplay = cat ? `${cat.icon} ${cat.name}` : skill.category;

  const BORDER = "─".repeat(50);
  console.log("\n" + chalk.cyan(BORDER));
  console.log(chalk.cyan(`  Skill: ${skill.name}`));
  console.log(chalk.cyan(BORDER));
  console.log(`  ${chalk.gray("ID".padEnd(15))} ${chalk.white(skill.id)}`);
  console.log(`  ${chalk.gray("Category".padEnd(15))} ${catDisplay}`);
  console.log(`  ${chalk.gray("Description".padEnd(15))} ${chalk.white(skill.description)}`);
  console.log(
    `  ${chalk.gray("Status".padEnd(15))} ${
      isEnabled ? chalk.green("enabled") : chalk.red("disabled")
    }`
  );
  console.log(`  ${chalk.gray("Tools".padEnd(15))} ${chalk.gray("Multiple tools available")}`);
  console.log();

  // Show preset membership
  const presetsWithSkill = Object.entries(SKILL_PRESETS)
    .filter(([, ids]) => ids.includes(skill.id))
    .map(([preset]) => preset);
  if (presetsWithSkill.length > 0) {
    console.log(`  ${chalk.gray("Included in".padEnd(15))} ${chalk.cyan(presetsWithSkill.join(", "))}`);
    console.log();
  }
}

// ---------------------------------------------------------------------------
// skills preset
// ---------------------------------------------------------------------------

function skillsPreset(name: string): void {
  const validPresets = Object.keys(SKILL_PRESETS) as Array<keyof typeof SKILL_PRESETS>;
  if (!validPresets.includes(name as keyof typeof SKILL_PRESETS)) {
    console.error(
      chalk.red(`Unknown preset '${name}'. Valid presets: ${validPresets.join(", ")}`)
    );
    process.exit(1);
  }

  const config = requireConfig();
  const preset = name as keyof typeof SKILL_PRESETS;
  const skills = config.skills ?? { preset: "standard", enabled: [], disabled: [], config: {} };

  const updatedConfig: NovaClawConfig = {
    ...config,
    skills: {
      ...skills,
      preset: preset as NovaClawConfig["skills"]["preset"],
      enabled: [] as string[],
      disabled: [] as string[],
    },
  };

  saveConfig(updatedConfig);

  const skillCount = SKILL_PRESETS[preset].length;
  console.log(
    `${chalk.green("✓")} Preset switched to ${chalk.cyan(name)} ` +
    chalk.gray(`(${skillCount} skills enabled)`)
  );
  console.log(chalk.gray("  enabled: " + SKILL_PRESETS[preset].slice(0, 6).join(", ") +
    (skillCount > 6 ? ` ... +${skillCount - 6} more` : "")));
}

// ---------------------------------------------------------------------------
// Export command
// ---------------------------------------------------------------------------

export const skillsCommand = new Command("skills")
  .description("Manage NovaClaw skills");

skillsCommand
  .command("list")
  .description("List all skills with their status")
  .option("--enabled", "Show only enabled skills")
  .option("--disabled", "Show only disabled skills")
  .option("--category <category>", "Filter by category (web, system, files, code, network, data, communication, automation)")
  .action((options: { enabled?: boolean; disabled?: boolean; category?: string }) => {
    skillsList(options);
  });

skillsCommand
  .command("enable <name>")
  .description("Enable a skill by ID")
  .action((name: string) => {
    skillsEnable(name);
  });

skillsCommand
  .command("disable <name>")
  .description("Disable a skill by ID")
  .action((name: string) => {
    skillsDisable(name);
  });

skillsCommand
  .command("info <name>")
  .description("Show detailed information about a skill")
  .action((name: string) => {
    skillsInfo(name);
  });

skillsCommand
  .command("preset <name>")
  .description("Switch to a skill preset (minimal, standard, developer, power, full)")
  .action((name: string) => {
    skillsPreset(name);
  });
