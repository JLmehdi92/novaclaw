// src/skills/data/image-analyzer.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import fs from "fs";
import path from "path";

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class ImageAnalyzerSkill extends BaseSkill {
  name = "image-analyzer";
  description =
    "Prepare images for Claude Vision analysis. Reads an image file or accepts base64 and returns metadata + base64 data ready for vision models.";
  category = "data";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["load_file", "validate_base64", "info"],
        description:
          "Action: load_file (read image from disk, return base64 + metadata), validate_base64 (check if base64 is valid image data), info (describe how to use Claude Vision)",
      },
      image_path: {
        type: "string",
        description: "Absolute path to the image file (for action=load_file)",
      },
      base64: {
        type: "string",
        description: "Base64-encoded image data (for action=validate_base64)",
      },
      media_type: {
        type: "string",
        enum: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        description: "MIME type of the base64 image (for action=validate_base64)",
      },
    },
    required: ["action"],
  };

  async execute(args: Record<string, unknown>, context: SkillContext): Promise<string> {
    const action = args.action as string;

    logger.info(`[ImageAnalyzer] action=${action} (user: ${context.userId})`);

    switch (action) {
      case "load_file":
        return this.loadFile(args.image_path as string);

      case "validate_base64":
        return this.validateBase64(args.base64 as string, args.media_type as string);

      case "info":
        return this.info();

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private async loadFile(imagePath: string): Promise<string> {
    if (!imagePath) throw new SkillError("image_path is required for action=load_file");

    const resolved = path.resolve(imagePath);
    const ext = path.extname(resolved).toLowerCase();

    if (!fs.existsSync(resolved)) {
      throw new SkillError(`File not found: ${resolved}`);
    }

    const mimeType = SUPPORTED_MIME_TYPES[ext];
    if (!mimeType) {
      throw new SkillError(
        `Unsupported file type: "${ext}". Supported: ${Object.keys(SUPPORTED_MIME_TYPES).join(", ")}`
      );
    }

    const stat = fs.statSync(resolved);
    if (stat.size > MAX_IMAGE_SIZE_BYTES) {
      throw new SkillError(
        `Image too large: ${(stat.size / 1024 / 1024).toFixed(2)} MB. Maximum allowed: 5 MB.`
      );
    }

    const buffer = fs.readFileSync(resolved);
    const base64 = buffer.toString("base64");

    return [
      "Image loaded successfully.",
      `File: ${path.basename(resolved)}`,
      `Size: ${(stat.size / 1024).toFixed(2)} KB`,
      `MIME type: ${mimeType}`,
      `Dimensions info: use an image library for pixel dimensions.`,
      ``,
      `To analyze this image with Claude Vision, use the following data:`,
      `  media_type: ${mimeType}`,
      `  base64 length: ${base64.length} characters`,
      ``,
      `Base64 data (first 100 chars): ${base64.slice(0, 100)}...`,
      ``,
      `Full base64:`,
      base64,
    ].join("\n");
  }

  private validateBase64(base64: string, mediaType: string): string {
    if (!base64) throw new SkillError("base64 is required for action=validate_base64");

    // Strip data URL prefix if present
    const cleaned = base64.replace(/^data:[^;]+;base64,/, "");

    // Validate base64 characters
    const validBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned);
    if (!validBase64) {
      return "Validation failed: data contains invalid base64 characters.";
    }

    // Check length is a multiple of 4
    if (cleaned.length % 4 !== 0) {
      return `Validation failed: base64 length (${cleaned.length}) is not a multiple of 4.`;
    }

    const estimatedBytes = Math.floor((cleaned.length * 3) / 4);
    const estimatedKb = (estimatedBytes / 1024).toFixed(2);

    const lines = [
      "Base64 validation passed.",
      `Base64 length: ${cleaned.length} chars`,
      `Estimated decoded size: ~${estimatedKb} KB`,
    ];

    if (mediaType) {
      const validTypes = Object.values(SUPPORTED_MIME_TYPES);
      if (validTypes.includes(mediaType)) {
        lines.push(`Media type: ${mediaType} (supported)`);
      } else {
        lines.push(`Media type: ${mediaType} (WARNING: may not be supported by Claude Vision)`);
      }
    } else {
      lines.push("Media type: not specified (recommend setting media_type)");
    }

    lines.push("", "This image data is ready for Claude Vision analysis.");
    return lines.join("\n");
  }

  private info(): string {
    return [
      "=== Claude Vision Integration ===",
      "",
      "This skill prepares images for analysis by Claude Vision (claude-3 and claude-4 models).",
      "",
      "How to analyze an image with Claude Vision:",
      "  1. Use action=load_file with the image_path to load a local image.",
      "     The skill will return the base64-encoded data and media type.",
      "  2. Alternatively, supply your own base64 data and validate it with action=validate_base64.",
      "  3. Pass the returned base64 + media_type to the Claude API as an image block:",
      "     {",
      '       "type": "image",',
      '       "source": {',
      '         "type": "base64",',
      '         "media_type": "<media_type>",',
      '         "data": "<base64_data>"',
      "       }",
      "     }",
      "",
      "Supported formats: JPEG, PNG, GIF, WebP",
      "Max file size: 5 MB",
      "",
      "Claude Vision can describe images, extract text (OCR), identify objects,",
      "analyze charts/graphs, and answer questions about image content.",
    ].join("\n");
  }
}
