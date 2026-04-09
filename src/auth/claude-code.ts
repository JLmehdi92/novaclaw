// src/auth/claude-code.ts
// Claude Code credential auto-discovery (like Hermes Agent)
import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "../utils/logger.js";

export interface ClaudeCodeCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  email?: string;
}

interface ClaudeCredentialsFile {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    email?: string;
  };
  // Alternative format
  oauth?: {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    email?: string;
  };
}

/**
 * Get the Claude Code config directory path
 */
export function getClaudeCodePath(): string {
  // Check environment variable first
  if (process.env.CLAUDE_CONFIG_DIR) {
    return process.env.CLAUDE_CONFIG_DIR;
  }

  // Default locations
  if (process.platform === "win32") {
    // Windows: %USERPROFILE%\.claude or %APPDATA%\claude
    const userProfile = process.env.USERPROFILE || os.homedir();
    const dotClaude = path.join(userProfile, ".claude");
    if (fs.existsSync(dotClaude)) return dotClaude;

    const appData = process.env.APPDATA;
    if (appData) {
      const appDataClaude = path.join(appData, "claude");
      if (fs.existsSync(appDataClaude)) return appDataClaude;
    }
    return dotClaude; // Default to ~/.claude
  }

  // Linux/macOS: ~/.claude
  return path.join(os.homedir(), ".claude");
}

/**
 * Get the credentials file path
 */
export function getCredentialsFilePath(): string {
  return path.join(getClaudeCodePath(), ".credentials.json");
}

/**
 * Check if Claude Code is installed and has credentials
 */
export function detectClaudeCode(): boolean {
  const credPath = getCredentialsFilePath();
  return fs.existsSync(credPath);
}

/**
 * Read Claude Code credentials from the credentials file
 */
export function readClaudeCredentials(): ClaudeCodeCredentials | null {
  const credPath = getCredentialsFilePath();

  if (!fs.existsSync(credPath)) {
    logger.debug(`Claude Code credentials not found at ${credPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(credPath, "utf-8");

    let data: ClaudeCredentialsFile;
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      logger.error(`Fichier credentials Claude Code corrompu ou JSON invalide: ${credPath}`);
      logger.debug(`Erreur de parsing: ${parseError}`);
      return null;
    }

    // Try claudeAiOauth format first (newer)
    if (data.claudeAiOauth?.accessToken) {
      return {
        accessToken: data.claudeAiOauth.accessToken,
        refreshToken: data.claudeAiOauth.refreshToken,
        expiresAt: data.claudeAiOauth.expiresAt,
        email: data.claudeAiOauth.email,
      };
    }

    // Try oauth format (alternative)
    if (data.oauth?.access_token) {
      return {
        accessToken: data.oauth.access_token,
        refreshToken: data.oauth.refresh_token,
        expiresAt: data.oauth.expires_at,
        email: data.oauth.email,
      };
    }

    logger.debug("Claude Code credentials file found but no valid token");
    return null;
  } catch (error) {
    logger.error(`Failed to read Claude Code credentials: ${error}`);
    return null;
  }
}

/**
 * Check if the token is still valid (not expired)
 */
export function isTokenValid(credentials: ClaudeCodeCredentials): boolean {
  if (!credentials.expiresAt) {
    // No expiry info, assume valid
    return true;
  }

  try {
    const expiresAt = new Date(credentials.expiresAt);
    const now = new Date();
    // Add 5 minute buffer
    const bufferMs = 5 * 60 * 1000;
    return expiresAt.getTime() > now.getTime() + bufferMs;
  } catch {
    return true; // If we can't parse, assume valid
  }
}

/**
 * Get token expiry as a human-readable string
 */
export function getTokenExpiry(credentials: ClaudeCodeCredentials): string {
  if (!credentials.expiresAt) {
    return "inconnu";
  }

  try {
    const expiresAt = new Date(credentials.expiresAt);
    return expiresAt.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "inconnu";
  }
}

/**
 * Get the access token, reading fresh from file each time
 * This ensures we always have the latest token if Claude Code refreshed it
 */
export function getAccessToken(): string | null {
  const credentials = readClaudeCredentials();
  if (!credentials) return null;

  if (!isTokenValid(credentials)) {
    logger.warn("Claude Code token expired, needs refresh via 'claude login'");
    return null;
  }

  return credentials.accessToken;
}

/**
 * Check if user can use Claude Code OAuth
 * Returns detailed status for setup wizard
 */
export function checkClaudeCodeStatus(): {
  available: boolean;
  email?: string;
  expiresAt?: string;
  error?: string;
} {
  if (!detectClaudeCode()) {
    return {
      available: false,
      error: "Claude Code non installé ou non configuré",
    };
  }

  const credentials = readClaudeCredentials();
  if (!credentials) {
    return {
      available: false,
      error: "Credentials non trouvés - exécute 'claude login'",
    };
  }

  if (!isTokenValid(credentials)) {
    return {
      available: false,
      email: credentials.email,
      error: "Token expiré - exécute 'claude login' pour renouveler",
    };
  }

  return {
    available: true,
    email: credentials.email,
    expiresAt: getTokenExpiry(credentials),
  };
}

/**
 * Instructions for setting up Claude Code
 */
export function getClaudeCodeSetupInstructions(): string {
  return `
Pour utiliser ton abonnement Claude avec NovaClaw :

1. Installe Claude Code :
   npm install -g @anthropic-ai/claude-code

2. Connecte-toi :
   claude login

3. Relance le setup NovaClaw :
   novaclaw setup
`;
}
