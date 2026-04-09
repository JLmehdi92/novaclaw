// src/skills/data/text-analyzer.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

// Simple language detection heuristics based on common function words
const LANGUAGE_SIGNATURES: Array<{ lang: string; words: string[] }> = [
  { lang: "English", words: ["the", "is", "are", "was", "were", "have", "has", "that", "this", "with", "from", "they"] },
  { lang: "French", words: ["le", "la", "les", "est", "sont", "avec", "dans", "pour", "que", "qui", "une", "des", "du"] },
  { lang: "Spanish", words: ["el", "la", "los", "las", "es", "son", "con", "para", "que", "una", "del", "por"] },
  { lang: "German", words: ["der", "die", "das", "ist", "sind", "mit", "für", "und", "ein", "eine", "nicht", "sie"] },
  { lang: "Portuguese", words: ["o", "a", "os", "as", "é", "são", "com", "para", "que", "uma", "dos", "não"] },
  { lang: "Italian", words: ["il", "la", "i", "le", "è", "sono", "con", "per", "che", "una", "del", "non"] },
  { lang: "Arabic", words: ["في", "من", "على", "إلى", "هذا", "هذه", "كان", "كانت", "التي", "الذي"] },
];

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  const tokens = lower.split(/\s+/);
  const wordSet = new Set(tokens);

  let bestLang = "Unknown";
  let bestScore = 0;

  for (const { lang, words } of LANGUAGE_SIGNATURES) {
    let score = 0;
    for (const w of words) {
      if (wordSet.has(w)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  return bestScore >= 2 ? bestLang : "Unknown";
}

export class TextAnalyzerSkill extends BaseSkill {
  name = "text-analyzer";
  description =
    "Analyze text: word/character count, extract emails/URLs/phone numbers, detect language, and provide structural statistics.";
  category = "data";
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["stats", "extract_emails", "extract_urls", "extract_phones", "detect_language", "full_analysis"],
        description:
          "Action: stats (counts), extract_emails, extract_urls, extract_phones, detect_language, full_analysis (all of the above)",
      },
      text: {
        type: "string",
        description: "Text to analyze",
      },
    },
    required: ["action", "text"],
  };

  async execute(args: Record<string, unknown>, _context: SkillContext): Promise<string> {
    const action = args.action as string;
    const text = args.text as string;

    if (!text) throw new SkillError("text is required");

    logger.info(`[TextAnalyzer] action=${action}, length=${text.length}`);

    switch (action) {
      case "stats":
        return this.stats(text);

      case "extract_emails":
        return this.extractEmails(text);

      case "extract_urls":
        return this.extractUrls(text);

      case "extract_phones":
        return this.extractPhones(text);

      case "detect_language":
        return this.languageDetection(text);

      case "full_analysis":
        return this.fullAnalysis(text);

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private stats(text: string): string {
    const charCount = text.length;
    const charNoSpaces = text.replace(/\s/g, "").length;
    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
    const lines = text.split(/\n/).length;
    const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-zA-Z0-9]/g, ""))).size;
    const avgWordLength = wordCount > 0
      ? (words.reduce((sum, w) => sum + w.length, 0) / wordCount).toFixed(2)
      : "0";

    return [
      "=== Text Statistics ===",
      `Characters: ${charCount}`,
      `Characters (no spaces): ${charNoSpaces}`,
      `Words: ${wordCount}`,
      `Unique words: ${uniqueWords}`,
      `Sentences: ${sentences}`,
      `Paragraphs: ${paragraphs}`,
      `Lines: ${lines}`,
      `Average word length: ${avgWordLength}`,
    ].join("\n");
  }

  private extractEmails(text: string): string {
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const matches = [...new Set(text.match(emailRegex) || [])];
    if (matches.length === 0) return "No email addresses found.";
    return `Email addresses found (${matches.length}):\n${matches.map((e) => `  - ${e}`).join("\n")}`;
  }

  private extractUrls(text: string): string {
    const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
    const matches = [...new Set(text.match(urlRegex) || [])];
    if (matches.length === 0) return "No URLs found.";
    return `URLs found (${matches.length}):\n${matches.map((u) => `  - ${u}`).join("\n")}`;
  }

  private extractPhones(text: string): string {
    // Matches common international and local phone formats
    const phoneRegex = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}(?:[\s\-.]?\d{1,4})?/g;
    const raw = text.match(phoneRegex) || [];
    // Filter out short sequences that are unlikely to be phone numbers
    const matches = [...new Set(raw.filter((m) => m.replace(/\D/g, "").length >= 7))];
    if (matches.length === 0) return "No phone numbers found.";
    return `Phone numbers found (${matches.length}):\n${matches.map((p) => `  - ${p}`).join("\n")}`;
  }

  private languageDetection(text: string): string {
    const lang = detectLanguage(text);
    return `Detected language: ${lang}`;
  }

  private fullAnalysis(text: string): string {
    const sections = [
      this.stats(text),
      "",
      "=== Language Detection ===",
      this.languageDetection(text),
      "",
      "=== Extracted Emails ===",
      this.extractEmails(text),
      "",
      "=== Extracted URLs ===",
      this.extractUrls(text),
      "",
      "=== Extracted Phone Numbers ===",
      this.extractPhones(text),
    ];
    return sections.join("\n");
  }
}
