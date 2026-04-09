// src/cli/commands/service.ts
import { Command } from "commander";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { execSync, spawn } from "child_process";
import { loadConfig, saveConfig, configExists } from "../../config/loader.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireWindows(): void {
  if (process.platform !== "win32") {
    console.error(chalk.red("Service commands are only available on Windows."));
    process.exit(1);
  }
}

function requireConfig(): ReturnType<typeof loadConfig> {
  if (!configExists()) {
    console.error(chalk.red("No configuration found. Run 'novaclaw setup' first."));
    process.exit(1);
  }
  return loadConfig();
}

function getServiceName(): string {
  try {
    const config = loadConfig();
    return config.service?.name ?? "NovaClaw";
  } catch {
    return "NovaClaw";
  }
}

/** Build the absolute path to dist/index.js from cwd or __dirname. */
function getScriptPath(): string {
  // Walk up from process.cwd() looking for package.json
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return path.join(dir, "dist", "index.js");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: resolve relative to this file (dist/cli/commands/service.js → ../../index.js)
  const thisFile = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  return path.resolve(path.dirname(thisFile), "..", "..", "index.js");
}

/** Check if the Windows service is installed by querying sc.exe. */
function isServiceInstalled(name: string): boolean {
  try {
    execSync(`sc query "${name}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Check if the Windows service is currently running. */
function isServiceRunning(name: string): boolean {
  try {
    const output = execSync(`sc query "${name}"`, { encoding: "utf-8" });
    return output.includes("RUNNING");
  } catch {
    return false;
  }
}

/** Get service state string from sc.exe output. */
function getServiceState(name: string): string {
  try {
    const output = execSync(`sc query "${name}"`, { encoding: "utf-8" });
    const match = output.match(/STATE\s*:\s*\d+\s+([A-Z_]+)/);
    if (match) return match[1];
    return "UNKNOWN";
  } catch {
    return "NOT_INSTALLED";
  }
}

// ---------------------------------------------------------------------------
// service install
// ---------------------------------------------------------------------------

async function serviceInstall(): Promise<void> {
  requireWindows();
  const config = requireConfig();
  const serviceName = config.service?.name ?? "NovaClaw";
  const scriptPath = getScriptPath();

  if (isServiceInstalled(serviceName)) {
    console.log(chalk.yellow(`Service '${serviceName}' is already installed.`));
    console.log(chalk.gray("Use 'novaclaw service uninstall' to remove it first."));
    return;
  }

  if (!fs.existsSync(scriptPath)) {
    console.error(chalk.red(`Script not found: ${scriptPath}`));
    console.error(chalk.yellow("Run 'npm run build' first to compile the project."));
    process.exit(1);
  }

  console.log(chalk.cyan(`Installing NovaClaw as Windows service...`));
  console.log(chalk.gray(`  Name:   ${serviceName}`));
  console.log(chalk.gray(`  Script: ${scriptPath}`));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeWindows = await import("node-windows" as any);
    const Service = (nodeWindows as any).Service;

    const svc = new Service({
      name: serviceName,
      description: "NovaClaw Personal AI Agent for Telegram",
      script: scriptPath,
      nodeOptions: [],
    });

    await new Promise<void>((resolve, reject) => {
      svc.on("install", () => {
        console.log(chalk.green(`Service '${serviceName}' installed successfully.`));
        console.log(chalk.cyan("Starting service..."));
        svc.start();
        resolve();
      });
      svc.on("alreadyinstalled", () => {
        console.log(chalk.yellow("Service is already installed."));
        resolve();
      });
      svc.on("error", (err: unknown) => {
        reject(err);
      });
      svc.install();
    });

    // Update config
    const updatedConfig = {
      ...config,
      service: {
        ...(config.service ?? {}),
        installed: true,
        name: serviceName,
        autoStart: true,
      },
    };
    saveConfig(updatedConfig);

    console.log(chalk.green(`\nService installed and started.`));
    console.log(chalk.gray("Use 'novaclaw service status' to check the service state."));
  } catch (err) {
    console.error(chalk.red(`Failed to install service: ${err}`));
    console.error(chalk.yellow("You may need to run this command as Administrator."));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// service uninstall
// ---------------------------------------------------------------------------

async function serviceUninstall(): Promise<void> {
  requireWindows();
  const config = requireConfig();
  const serviceName = config.service?.name ?? "NovaClaw";
  const scriptPath = getScriptPath();

  if (!isServiceInstalled(serviceName)) {
    console.log(chalk.yellow(`Service '${serviceName}' is not installed.`));
    return;
  }

  console.log(chalk.cyan(`Uninstalling service '${serviceName}'...`));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeWindows = await import("node-windows" as any);
    const Service = (nodeWindows as any).Service;

    const svc = new Service({
      name: serviceName,
      script: scriptPath,
    });

    await new Promise<void>((resolve, reject) => {
      svc.on("uninstall", () => {
        console.log(chalk.green(`Service '${serviceName}' uninstalled successfully.`));
        resolve();
      });
      svc.on("error", (err: unknown) => {
        reject(err);
      });
      svc.uninstall();
    });

    // Update config
    const updatedConfig = {
      ...config,
      service: {
        ...(config.service ?? {}),
        installed: false,
        name: serviceName,
      },
    };
    saveConfig(updatedConfig);

    console.log(chalk.gray("Run 'novaclaw service install' to reinstall."));
  } catch (err) {
    console.error(chalk.red(`Failed to uninstall service: ${err}`));
    console.error(chalk.yellow("You may need to run this command as Administrator."));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// service start
// ---------------------------------------------------------------------------

async function serviceStart(): Promise<void> {
  requireWindows();
  const serviceName = getServiceName();

  if (!isServiceInstalled(serviceName)) {
    console.error(chalk.red(`Service '${serviceName}' is not installed.`));
    console.error(chalk.yellow("Run 'novaclaw service install' first."));
    process.exit(1);
  }

  if (isServiceRunning(serviceName)) {
    console.log(chalk.yellow(`Service '${serviceName}' is already running.`));
    return;
  }

  console.log(chalk.cyan(`Starting service '${serviceName}'...`));

  try {
    execSync(`sc start "${serviceName}"`, { stdio: "ignore" });
    console.log(chalk.green(`Service '${serviceName}' started.`));
  } catch (err) {
    console.error(chalk.red(`Failed to start service: ${err}`));
    console.error(chalk.yellow("You may need to run this command as Administrator."));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// service stop
// ---------------------------------------------------------------------------

async function serviceStop(): Promise<void> {
  requireWindows();
  const serviceName = getServiceName();

  if (!isServiceInstalled(serviceName)) {
    console.error(chalk.red(`Service '${serviceName}' is not installed.`));
    process.exit(1);
  }

  if (!isServiceRunning(serviceName)) {
    console.log(chalk.yellow(`Service '${serviceName}' is not running.`));
    return;
  }

  console.log(chalk.cyan(`Stopping service '${serviceName}'...`));

  try {
    execSync(`sc stop "${serviceName}"`, { stdio: "ignore" });
    console.log(chalk.green(`Service '${serviceName}' stopped.`));
  } catch (err) {
    console.error(chalk.red(`Failed to stop service: ${err}`));
    console.error(chalk.yellow("You may need to run this command as Administrator."));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// service status
// ---------------------------------------------------------------------------

async function serviceStatus(): Promise<void> {
  requireWindows();
  const serviceName = getServiceName();

  const BORDER = "═".repeat(59);
  console.log("\n" + chalk.cyan(BORDER));
  console.log(chalk.cyan("  NovaClaw Service Status"));
  console.log(chalk.cyan(BORDER) + "\n");

  const installed = isServiceInstalled(serviceName);
  const running = installed && isServiceRunning(serviceName);
  const state = installed ? getServiceState(serviceName) : "NOT INSTALLED";
  const scriptPath = getScriptPath();

  // Try to get config for autoStart
  let autoStart = true;
  try {
    const config = loadConfig();
    autoStart = config.service?.autoStart ?? true;
  } catch {
    // config may not exist
  }

  const statusColor = running
    ? chalk.green
    : installed
    ? chalk.yellow
    : chalk.red;

  console.log(`${chalk.gray("Service:".padEnd(16))} ${chalk.white(serviceName)}`);
  console.log(
    `${chalk.gray("Status:".padEnd(16))} ${statusColor(
      running ? "Running" : installed ? state : "Not Installed"
    )}`
  );
  console.log(
    `${chalk.gray("Auto-start:".padEnd(16))} ${autoStart ? chalk.green("Yes") : chalk.red("No")}`
  );
  console.log(`${chalk.gray("Path:".padEnd(16))} ${chalk.gray(scriptPath)}`);

  if (installed) {
    // Try to get more info via sc queryex
    try {
      const qxOutput = execSync(`sc queryex "${serviceName}"`, { encoding: "utf-8" });
      const pidMatch = qxOutput.match(/PID\s*:\s*(\d+)/);
      if (pidMatch && pidMatch[1] !== "0") {
        console.log(`${chalk.gray("PID:".padEnd(16))} ${chalk.white(pidMatch[1])}`);
      }
    } catch {
      // not critical
    }
  }

  console.log();

  if (!installed) {
    console.log(chalk.gray("Run 'novaclaw service install' to install as a Windows service."));
  } else if (!running) {
    console.log(chalk.gray("Run 'novaclaw service start' to start the service."));
  } else {
    console.log(chalk.gray("Run 'novaclaw service stop' to stop the service."));
  }
  console.log();
}

// ---------------------------------------------------------------------------
// service logs
// ---------------------------------------------------------------------------

async function serviceLogs(options: { follow?: boolean }): Promise<void> {
  requireWindows();
  const serviceName = getServiceName();

  // node-windows stores daemon logs in the same directory as the script,
  // under a subfolder named after the service.
  // Typical locations:
  //   <script_dir>/<ServiceName>/<ServiceName>.log (stdout/stderr wrapper)
  //   %SystemRoot%\System32\LogFiles\Application\<ServiceName>*.log
  // We also check our own project logs directory.
  const scriptPath = getScriptPath();
  const scriptDir = path.dirname(scriptPath);

  const candidateDirs = [
    path.join(scriptDir, serviceName),
    path.join(scriptDir, serviceName.toLowerCase()),
    path.join(process.cwd(), "logs"),
    path.join(process.cwd(), "dist", serviceName),
  ];

  const logFiles: string[] = [];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(
        (f) => f.endsWith(".log") || f.endsWith(".txt")
      );
      for (const f of files) {
        logFiles.push(path.join(dir, f));
      }
    }
  }

  if (logFiles.length === 0) {
    console.log(chalk.yellow(`No log files found for service '${serviceName}'.`));
    console.log(chalk.gray("Log files are typically created once the service has run at least once."));
    console.log(chalk.gray("Expected locations:"));
    for (const dir of candidateDirs) {
      console.log(chalk.gray(`  ${dir}`));
    }
    return;
  }

  // Sort by modification time, most recent first
  logFiles.sort((a, b) => {
    try {
      return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
    } catch {
      return 0;
    }
  });

  const primaryLog = logFiles[0];

  console.log(chalk.cyan(`Showing logs from: ${primaryLog}`));
  if (logFiles.length > 1) {
    console.log(chalk.gray(`(${logFiles.length - 1} more log file(s) available)`));
  }
  console.log();

  if (options.follow) {
    // Live tail using PowerShell Get-Content -Wait
    console.log(chalk.cyan("Following log (Ctrl+C to stop)...\n"));
    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", `Get-Content -Path "${primaryLog}" -Wait -Tail 50`],
      { stdio: "inherit" }
    );
    ps.on("error", (err) => {
      console.error(chalk.red(`Failed to follow log: ${err.message}`));
    });
    // Keep process alive
    await new Promise<void>((resolve) => {
      ps.on("close", resolve);
    });
  } else {
    // Show last 100 lines
    try {
      const content = fs.readFileSync(primaryLog, "utf-8");
      const lines = content.split("\n");
      const last100 = lines.slice(Math.max(0, lines.length - 100));
      console.log(last100.join("\n"));
      console.log(chalk.gray(`\n(Last ${last100.length} lines of ${lines.length} total)`));
      console.log(chalk.gray("Use --follow / -f to stream live logs."));
    } catch (err) {
      console.error(chalk.red(`Failed to read log file: ${err}`));
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Export command
// ---------------------------------------------------------------------------

export const serviceCommand = new Command("service")
  .description("Manage NovaClaw Windows service");

serviceCommand
  .command("install")
  .description("Install NovaClaw as a Windows service")
  .action(async () => {
    await serviceInstall();
  });

serviceCommand
  .command("uninstall")
  .description("Remove the NovaClaw Windows service")
  .action(async () => {
    await serviceUninstall();
  });

serviceCommand
  .command("start")
  .description("Start the NovaClaw Windows service")
  .action(async () => {
    await serviceStart();
  });

serviceCommand
  .command("stop")
  .description("Stop the NovaClaw Windows service")
  .action(async () => {
    await serviceStop();
  });

serviceCommand
  .command("status")
  .description("Show NovaClaw service status")
  .action(async () => {
    await serviceStatus();
  });

serviceCommand
  .command("logs")
  .description("Show NovaClaw service logs")
  .option("-f, --follow", "Stream live log output")
  .action(async (options: { follow?: boolean }) => {
    await serviceLogs(options);
  });
