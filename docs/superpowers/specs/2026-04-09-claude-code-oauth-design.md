# Claude Code OAuth Integration - Design Spec

## Goal

Permettre à NovaClaw d'utiliser les credentials Claude Code existants pour authentifier l'utilisateur avec son abonnement Claude (Pro/Max).

## Architecture

### Détection des credentials

```
~/.claude/                      # Linux/Windows
├── .credentials.json           # OAuth tokens
└── settings.local.json         # User preferences

macOS: Keychain (service: 'claude-code')
```

### Structure .credentials.json

```json
{
  "claudeAiOauth": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "2026-05-15T...",
    "email": "user@example.com"
  }
}
```

## Fichiers

### Créer: `src/auth/claude-code.ts`

```typescript
// Fonctions principales
detectClaudeCode(): boolean
getClaudeCodePath(): string
readClaudeCredentials(): ClaudeCodeCredentials | null
isTokenValid(credentials): boolean
getAccessToken(): Promise<string | null>
```

### Modifier: `src/cli/commands/setup.ts`

- Détecter Claude Code au démarrage
- Nouvelle option "Claude Code (détecté)" si présent
- Lire et valider le token
- Stocker dans credentials.json

### Modifier: `src/claude/client.ts`

- Support pour OAuth token (header Authorization différent)
- Fallback sur API key si OAuth échoue

## Flow Setup

1. Vérifier si `~/.claude/.credentials.json` existe
2. Si oui:
   - Lire le token
   - Vérifier expiration
   - Afficher email du compte
   - Proposer comme option par défaut
3. Si non:
   - Proposer API Key
   - Ou guider vers `claude login`

## Sécurité

- Ne pas copier le refreshToken (laisser Claude Code le gérer)
- Lire le accessToken à chaque démarrage
- Respecter les permissions fichier (0600)
