// src/skills/files/files.ts
import { BaseSkill, SkillContext } from "../base.js";
import fs from "fs";
import path from "path";
import { SkillError } from "../../utils/errors.js";

export class FilesSkill extends BaseSkill {
  name = "file_ops";
  description = "Read, write, list, and delete files in the workspace";
  category = "files";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["read", "write", "list", "delete", "exists", "mkdir"],
        description: "The file operation to perform",
      },
      path: {
        type: "string",
        description: "The file or directory path (relative to workspace)",
      },
      content: {
        type: "string",
        description: "Content to write (only for write action)",
      },
    },
    required: ["action", "path"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;
    const relativePath = args.path as string;
    const content = args.content as string | undefined;

    // Ensure path is within workspace
    const fullPath = this.resolvePath(relativePath, context.workspace);

    switch (action) {
      case "read":
        return this.readFile(fullPath);
      case "write":
        if (!content) throw new SkillError("Content is required for write action");
        return this.writeFile(fullPath, content);
      case "list":
        return this.listDirectory(fullPath);
      case "delete":
        return this.deleteFile(fullPath);
      case "exists":
        return fs.existsSync(fullPath) ? "true" : "false";
      case "mkdir":
        return this.createDirectory(fullPath);
      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private resolvePath(relativePath: string, workspace: string): string {
    const resolved = path.resolve(workspace, relativePath);
    const normalizedWorkspace = path.resolve(workspace);

    if (!resolved.startsWith(normalizedWorkspace)) {
      throw new SkillError("Path traversal not allowed");
    }
    return resolved;
  }

  private readFile(fullPath: string): string {
    if (!fs.existsSync(fullPath)) {
      throw new SkillError(`File not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, "utf-8");
  }

  private writeFile(fullPath: string, content: string): string {
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, "utf-8");
    return `File written: ${path.basename(fullPath)}`;
  }

  private listDirectory(fullPath: string): string {
    if (!fs.existsSync(fullPath)) {
      throw new SkillError(`Directory not found: ${fullPath}`);
    }
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const list = entries.map((entry) => {
      const suffix = entry.isDirectory() ? "/" : "";
      return `${entry.name}${suffix}`;
    });
    return list.join("\n") || "(empty directory)";
  }

  private deleteFile(fullPath: string): string {
    if (!fs.existsSync(fullPath)) {
      throw new SkillError(`File not found: ${fullPath}`);
    }
    fs.unlinkSync(fullPath);
    return `File deleted: ${path.basename(fullPath)}`;
  }

  private createDirectory(fullPath: string): string {
    fs.mkdirSync(fullPath, { recursive: true });
    return `Directory created: ${path.basename(fullPath)}`;
  }
}
