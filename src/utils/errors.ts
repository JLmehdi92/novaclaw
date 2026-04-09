// src/utils/errors.ts
export class NovaClawError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "NovaClawError";
  }
}

export class ConfigError extends NovaClawError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFIG_ERROR", details);
    this.name = "ConfigError";
  }
}

export class AuthError extends NovaClawError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTH_ERROR", details);
    this.name = "AuthError";
  }
}

export class SkillError extends NovaClawError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SKILL_ERROR", details);
    this.name = "SkillError";
  }
}

export class DatabaseError extends NovaClawError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DATABASE_ERROR", details);
    this.name = "DatabaseError";
  }
}
