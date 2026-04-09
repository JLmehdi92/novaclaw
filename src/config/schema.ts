// src/config/schema.ts
import { z } from "zod";

export const AgentConfigSchema = z.object({
  name: z.string().default("NovaClaw"),
  language: z.enum(["fr", "en"]).default("fr"),
  personality: z.enum(["professional", "assistant", "casual", "minimal", "custom"]).default("assistant"),
  customSystemPrompt: z.string().nullable().default(null),
});

export const ProviderConfigSchema = z.object({
  type: z.literal("anthropic").default("anthropic"),
  authMethod: z.enum(["oauth", "apikey"]).default("oauth"),
  model: z.string().default("claude-sonnet-4-6"),
  fallbackModel: z.string().nullable().default("claude-haiku-4-5"),
});

export const TelegramChannelSchema = z.object({
  enabled: z.boolean().default(true),
  ownerId: z.number(),
  allowedUsers: z.array(z.number()).default([]),
});

export const ChannelsConfigSchema = z.object({
  telegram: TelegramChannelSchema,
});

export const SkillsConfigSchema = z.object({
  preset: z.enum(["minimal", "standard", "developer", "power", "full"]).default("standard"),
  enabled: z.array(z.string()).default([]),
  disabled: z.array(z.string()).default([]),
  config: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});

export const RateLimitSchema = z.object({
  messagesPerMinute: z.number().default(30),
  cooldownSeconds: z.number().default(60),
});

export const ShellSecuritySchema = z.object({
  mode: z.enum(["allowlist", "blocklist"]).default("allowlist"),
  allowedCommands: z.array(z.string()).default(["ls", "cat", "head", "tail", "grep", "find", "git", "npm", "node", "python"]),
  blockedCommands: z.array(z.string()).default([]),
});

export const HttpSecuritySchema = z.object({
  allowPrivateIPs: z.boolean().default(false),
  blockedDomains: z.array(z.string()).default([]),
});

export const CodeSecuritySchema = z.object({
  allowedLanguages: z.array(z.string()).default(["javascript", "python"]),
  maxExecutionTime: z.number().default(30000),
});

export const SecurityConfigSchema = z.object({
  rateLimit: RateLimitSchema.optional().default(() => RateLimitSchema.parse({})),
  shell: ShellSecuritySchema.optional().default(() => ShellSecuritySchema.parse({})),
  http: HttpSecuritySchema.optional().default(() => HttpSecuritySchema.parse({})),
  code: CodeSecuritySchema.optional().default(() => CodeSecuritySchema.parse({})),
});

export const GatewayConfigSchema = z.object({
  autoStart: z.boolean().default(true),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const ServiceConfigSchema = z.object({
  installed: z.boolean().default(false),
  name: z.string().default("NovaClaw"),
  autoStart: z.boolean().default(true),
});

export const NovaClawConfigSchema = z.object({
  version: z.literal("2.0").default("2.0"),
  agent: AgentConfigSchema.optional().default(() => AgentConfigSchema.parse({})),
  provider: ProviderConfigSchema.optional().default(() => ProviderConfigSchema.parse({})),
  channels: ChannelsConfigSchema,
  skills: SkillsConfigSchema.optional().default(() => SkillsConfigSchema.parse({})),
  security: SecurityConfigSchema.optional().default(() => SecurityConfigSchema.parse({})),
  gateway: GatewayConfigSchema.optional().default(() => GatewayConfigSchema.parse({})),
  service: ServiceConfigSchema.optional().default(() => ServiceConfigSchema.parse({})),
});

export const TelegramCredentialsSchema = z.object({
  botToken: z.string(),
});

export const AnthropicCredentialsSchema = z.object({
  authMethod: z.enum(["oauth", "apikey"]),
  apiKey: z.string().nullable().default(null),
  oauthToken: z.string().nullable().default(null),
  oauthEmail: z.string().nullable().default(null),
});

export const CredentialsSchema = z.object({
  telegram: TelegramCredentialsSchema,
  anthropic: AnthropicCredentialsSchema,
});

export type NovaClawConfig = z.infer<typeof NovaClawConfigSchema>;
export type Credentials = z.infer<typeof CredentialsSchema>;
