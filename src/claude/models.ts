// src/claude/models.ts
export interface ClaudeModel {
  id: string;
  alias?: string;
  name: string;
  generation: string;
  description: string;
  contextWindow: number;
  maxOutput: number;
  pricing: { input: number; output: number };
  releaseDate: string;
  recommended?: boolean;
  legacy?: boolean;
}

export const CLAUDE_MODELS: Record<string, ClaudeModel> = {
  "opus-4.6": {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    generation: "4.6",
    description: "Le plus intelligent - 1M context, 128k output",
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    pricing: { input: 5, output: 25 },
    releaseDate: "2026-02-05",
    recommended: true,
  },
  "sonnet-4.6": {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    generation: "4.6",
    description: "Equilibre - 1M context, rapide",
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    pricing: { input: 3, output: 15 },
    releaseDate: "2026-02-17",
    recommended: true,
  },
  "opus-4.5": {
    id: "claude-opus-4-5-20251101",
    alias: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    generation: "4.5",
    description: "Tres puissant - agents complexes",
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { input: 5, output: 25 },
    releaseDate: "2025-11-01",
  },
  "sonnet-4.5": {
    id: "claude-sonnet-4-5-20250929",
    alias: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    generation: "4.5",
    description: "Meilleur coding de sa generation",
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { input: 3, output: 15 },
    releaseDate: "2025-09-29",
  },
  "haiku-4.5": {
    id: "claude-haiku-4-5-20251001",
    alias: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    generation: "4.5",
    description: "Ultra-rapide, economique",
    contextWindow: 200_000,
    maxOutput: 64_000,
    pricing: { input: 1, output: 5 },
    releaseDate: "2025-10-01",
  },
};

export const DEFAULT_MODEL = "sonnet-4.6";

export function getModelById(modelId: string): ClaudeModel | undefined {
  if (CLAUDE_MODELS[modelId]) return CLAUDE_MODELS[modelId];
  return Object.values(CLAUDE_MODELS).find(
    (m) => m.id === modelId || m.alias === modelId
  );
}

export function getModelId(shortName: string): string {
  const model = CLAUDE_MODELS[shortName];
  return model?.id || shortName;
}

export function listModels(): ClaudeModel[] {
  return Object.values(CLAUDE_MODELS);
}

export function getRecommendedModels(): ClaudeModel[] {
  return Object.values(CLAUDE_MODELS).filter((m) => m.recommended);
}
