// src/cli/commands/update.ts
import { Command } from "commander";
import { execSync } from "child_process";
import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs";

/**
 * Find the NovaClaw project root (where package.json is)
 */
function findProjectRoot(): string {
  // Try from the script location
  let dir = path.dirname(process.argv[1]);

  // Go up until we find package.json with name "novaclaw"
  for (let i = 0; i < 5; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "novaclaw") {
          return dir;
        }
      } catch {}
    }
    dir = path.dirname(dir);
  }

  // Fallback to cwd
  return process.cwd();
}

/**
 * Run a shell command and return output
 */
function runCommand(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output: output.trim() };
  } catch (error: any) {
    return { success: false, output: error.message || String(error) };
  }
}

/**
 * Get current version from package.json
 */
function getVersion(projectRoot: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

export const updateCommand = new Command("update")
  .description("Update NovaClaw from GitHub (git pull + npm install + build)")
  .option("-f, --force", "Discard local changes before pulling")
  .option("--no-install", "Skip npm install")
  .option("--no-build", "Skip build step")
  .action(async (options) => {
    console.log(chalk.cyan.bold("\n━━ NovaClaw Update ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

    const projectRoot = findProjectRoot();
    const versionBefore = getVersion(projectRoot);

    console.log(chalk.gray(`Dossier: ${projectRoot}`));
    console.log(chalk.gray(`Version actuelle: v${versionBefore}\n`));

    // Step 1: Check git
    const spinnerGit = ora("[1/4] Vérification git...").start();
    const gitCheck = runCommand("git status --porcelain", projectRoot);

    if (!gitCheck.success) {
      spinnerGit.fail("Ce dossier n'est pas un repo git");
      process.exit(1);
    }

    const hasLocalChanges = gitCheck.output.length > 0;

    if (hasLocalChanges && !options.force) {
      spinnerGit.warn("Modifications locales détectées");
      console.log(chalk.yellow("  Utilise --force pour les écraser, ou commit-les d'abord.\n"));
      console.log(chalk.gray("  Fichiers modifiés:"));
      console.log(chalk.gray("  " + gitCheck.output.split("\n").slice(0, 5).join("\n  ")));
      if (gitCheck.output.split("\n").length > 5) {
        console.log(chalk.gray("  ..."));
      }
      process.exit(1);
    }

    spinnerGit.succeed("[1/4] Git OK");

    // Step 1b: Force reset if requested
    if (options.force && hasLocalChanges) {
      const spinnerReset = ora("    Réinitialisation des modifications locales...").start();
      const resetResult = runCommand("git checkout -- . && git clean -fd", projectRoot);
      if (!resetResult.success) {
        spinnerReset.fail("Échec du reset");
        process.exit(1);
      }
      spinnerReset.succeed("    Modifications locales supprimées");
    }

    // Step 2: Git pull
    const spinnerPull = ora("[2/4] git pull origin main...").start();
    const pullResult = runCommand("git pull origin main", projectRoot);

    if (!pullResult.success) {
      spinnerPull.fail("Échec du git pull");
      console.log(chalk.red(pullResult.output));
      process.exit(1);
    }

    if (pullResult.output.includes("Already up to date")) {
      spinnerPull.succeed("[2/4] Déjà à jour");
    } else {
      // Count changed files
      const filesChanged = pullResult.output.match(/(\d+) files? changed/);
      const changeInfo = filesChanged ? `(${filesChanged[1]} fichiers)` : "";
      spinnerPull.succeed(`[2/4] git pull OK ${chalk.gray(changeInfo)}`);
    }

    // Step 3: npm install
    if (options.install !== false) {
      const spinnerInstall = ora("[3/4] npm install...").start();
      const installResult = runCommand("npm install", projectRoot);

      if (!installResult.success) {
        spinnerInstall.fail("Échec du npm install");
        console.log(chalk.red(installResult.output));
        process.exit(1);
      }
      spinnerInstall.succeed("[3/4] npm install OK");
    } else {
      console.log(chalk.gray("[3/4] npm install skipped"));
    }

    // Step 4: Build
    if (options.build !== false) {
      const spinnerBuild = ora("[4/4] npm run build...").start();
      const buildResult = runCommand("npm run build", projectRoot);

      if (!buildResult.success) {
        spinnerBuild.fail("Échec du build");
        console.log(chalk.red(buildResult.output));
        process.exit(1);
      }
      spinnerBuild.succeed("[4/4] Build OK");
    } else {
      console.log(chalk.gray("[4/4] Build skipped"));
    }

    // Done
    const versionAfter = getVersion(projectRoot);

    console.log(chalk.green.bold(`\n✅ NovaClaw mis à jour ! (v${versionAfter})\n`));

    if (versionBefore !== versionAfter) {
      console.log(chalk.cyan(`   ${versionBefore} → ${versionAfter}`));
    }

    console.log(chalk.gray("Commandes utiles:"));
    console.log(chalk.gray("  novaclaw start    - Démarrer l'agent"));
    console.log(chalk.gray("  novaclaw status   - Voir le statut\n"));
  });
