# NovaClaw Setup Wizard v2.0 - Design Spec

## Goal

Refonte complète du setup wizard NovaClaw pour offrir une expérience d'onboarding professionnelle comparable à OpenClaw, avec configuration complète des 42 skills, sécurité avancée, et installation service Windows.

## Architecture

### Structure des dossiers

```
~/.novaclaw/                    # Répertoire principal (portable: ./novaclaw/)
├── novaclaw.json               # Config principale (non-sensible)
├── credentials.json            # Secrets (tokens, API keys) - gitignored
├── data/
│   └── novaclaw.db             # SQLite database
├── workspaces/
│   └── <user_id>/              # Workspace isolé par utilisateur
├── skills/                     # Skills custom (optionnel)
│   └── my-skill/
│       └── SKILL.md
└── logs/
    └── novaclaw.log
```

### Configuration principale (novaclaw.json)

```json
{
  "version": "2.0",
  "agent": {
    "name": "NovaClaw",
    "language": "fr",
    "personality": "assistant",
    "customSystemPrompt": null
  },
  "provider": {
    "type": "anthropic",
    "authMethod": "oauth",
    "model": "claude-sonnet-4-6",
    "fallbackModel": "claude-haiku-4-5"
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "ownerId": 123456789,
      "allowedUsers": [123456789]
    }
  },
  "skills": {
    "preset": "standard",
    "enabled": ["browser", "shell", "files", "code-runner", "http", "git"],
    "disabled": [],
    "config": {
      "browser": { "headless": true, "timeout": 30000 },
      "shell": { "timeout": 60000 },
      "code-runner": { "timeout": 30000 }
    }
  },
  "security": {
    "rateLimit": {
      "messagesPerMinute": 30,
      "cooldownSeconds": 60
    },
    "shell": {
      "mode": "allowlist",
      "allowedCommands": ["ls", "cat", "head", "tail", "grep", "find", "git", "npm", "node", "python"]
    },
    "http": {
      "allowPrivateIPs": false,
      "blockedDomains": []
    },
    "code": {
      "allowedLanguages": ["javascript", "python"],
      "maxExecutionTime": 30000
    }
  },
  "gateway": {
    "autoStart": true,
    "logLevel": "info"
  },
  "service": {
    "installed": false,
    "name": "NovaClaw",
    "autoStart": true
  }
}
```

### Credentials (credentials.json)

```json
{
  "telegram": {
    "botToken": "7123456789:AAH..."
  },
  "anthropic": {
    "authMethod": "oauth",
    "apiKey": null,
    "oauthToken": "encrypted_token_here",
    "oauthEmail": "user@example.com"
  }
}
```

---

## Skills (42 total en 8 catégories)

### WEB & BROWSER (6)
| ID | Nom | Description |
|----|-----|-------------|
| 1 | `browser` | Naviguer, rechercher, lire des pages web |
| 2 | `screenshot` | Capturer des pages web en image |
| 3 | `web-scraper` | Extraire des données structurées de sites |
| 4 | `pdf-reader` | Lire et extraire du texte de PDFs |
| 5 | `link-preview` | Prévisualiser les liens (titre, description, image) |
| 6 | `web-monitor` | Surveiller des pages et alerter si changement |

### SHELL & SYSTEM (6)
| ID | Nom | Description |
|----|-----|-------------|
| 7 | `shell` | Exécuter des commandes système |
| 8 | `process-manager` | Lister, tuer, monitorer des processus |
| 9 | `system-info` | CPU, RAM, disque, réseau |
| 10 | `package-manager` | npm, pip, apt, choco install/update |
| 11 | `service-manager` | Démarrer/arrêter des services Windows/Linux |
| 12 | `cron-scheduler` | Planifier des tâches récurrentes |

### FILES & STORAGE (6)
| ID | Nom | Description |
|----|-----|-------------|
| 13 | `files` | CRUD fichiers (lire, écrire, supprimer, lister) |
| 14 | `file-search` | Rechercher des fichiers par nom/contenu |
| 15 | `archive` | Créer/extraire ZIP, TAR, 7z |
| 16 | `file-convert` | Convertir formats (md→pdf, json→csv, etc.) |
| 17 | `file-watch` | Surveiller un dossier et alerter si changement |
| 18 | `cloud-storage` | Upload/download Google Drive, Dropbox, S3 |

### CODE & DEV (7)
| ID | Nom | Description |
|----|-----|-------------|
| 19 | `code-runner` | Exécuter JS, Python, Bash, TypeScript |
| 20 | `code-analyzer` | Analyser du code (complexité, bugs potentiels) |
| 21 | `git` | Clone, commit, push, pull, branches, diff |
| 22 | `github` | Issues, PRs, repos, actions via API GitHub |
| 23 | `docker` | Build, run, stop, logs containers |
| 24 | `database` | Query SQLite, PostgreSQL, MySQL |
| 25 | `api-tester` | Tester des endpoints REST/GraphQL |

### NETWORK & HTTP (5)
| ID | Nom | Description |
|----|-----|-------------|
| 26 | `http` | Requêtes GET/POST/PUT/DELETE |
| 27 | `webhook-sender` | Envoyer des webhooks (Slack, Discord, etc.) |
| 28 | `webhook-receiver` | Recevoir et traiter des webhooks entrants |
| 29 | `dns-lookup` | Résoudre DNS, WHOIS, IP info |
| 30 | `port-scanner` | Scanner les ports ouverts d'un host |

### DATA & AI (5)
| ID | Nom | Description |
|----|-----|-------------|
| 31 | `json-processor` | Parser, transformer, valider JSON |
| 32 | `csv-processor` | Lire, filtrer, agréger des CSV |
| 33 | `text-analyzer` | Résumer, traduire, extraire entités |
| 34 | `image-analyzer` | Décrire des images (via Claude Vision) |
| 35 | `calculator` | Calculs mathématiques, conversions |

### COMMUNICATION (4)
| ID | Nom | Description |
|----|-----|-------------|
| 36 | `email-sender` | Envoyer des emails (SMTP) |
| 37 | `email-reader` | Lire des emails (IMAP) |
| 38 | `sms-sender` | Envoyer des SMS (Twilio, etc.) |
| 39 | `notification` | Notifications push, alertes système |

### AUTOMATION & IOT (3)
| ID | Nom | Description |
|----|-----|-------------|
| 40 | `home-assistant` | Contrôler des appareils domotiques |
| 41 | `macro-recorder` | Enregistrer et rejouer des séquences |
| 42 | `workflow` | Chaîner plusieurs skills en workflow |

---

## Presets de Skills

| Preset | Description | Skills | Total |
|--------|-------------|--------|-------|
| `minimal` | Essentiel uniquement | shell, files | 2 |
| `standard` | Usage quotidien | browser, shell, files, code-runner, http, git | 6 |
| `developer` | Développement | standard + github, docker, database, api-tester, json-processor | 11 |
| `power` | Utilisateur avancé | developer + web, data, automation skills | 25 |
| `full` | Tout activé | Les 42 skills | 42 |

---

## Presets de Personnalité

| Preset | Description | System Prompt Base |
|--------|-------------|-------------------|
| `professional` | Formel, concis | "Tu es un assistant professionnel. Réponses directes et factuelles." |
| `assistant` | Équilibré, amical | "Tu es NovaClaw, un assistant IA personnel. Helpful et précis." |
| `casual` | Décontracté | "Tu es un assistant cool et décontracté. Tu peux utiliser des émojis." |
| `minimal` | Ultra-court | "Réponses ultra-courtes. Pas de blabla." |
| `custom` | Personnalisé | L'utilisateur écrit son propre prompt |

---

## Presets de Sécurité

| Preset | Rate Limit | Shell | Code | HTTP |
|--------|-----------|-------|------|------|
| `strict` | 10/min | 5 commandes de base | JS only | Pas d'IPs privées |
| `balanced` | 30/min | 10 commandes courantes | JS, Python | Pas d'IPs privées |
| `permissive` | 60/min | Toutes commandes | Tous langages | IPs privées OK |

---

## Setup Wizard Flow

### Mode Selection

```
? Quel type de configuration ?
❯ ⚡ Rapide    - Telegram + Auth, défauts pour le reste (~2 min)
  🔧 Complète  - Tout configurer : skills, sécurité, personnalité (~5 min)
```

### Mode Rapide (4 étapes)

1. **Telegram** - Token bot + Owner ID
2. **Auth Claude** - OAuth ou API Key
3. **Langue** - FR ou EN
4. **Résumé + Confirmation**

### Mode Complet (6 sections)

1. **Telegram**
   - Token bot (validation via API)
   - Owner ID
   - Utilisateurs autorisés additionnels

2. **Auth Claude**
   - Choix méthode (OAuth / API Key)
   - OAuth: ouverture navigateur, callback
   - API Key: saisie + validation
   - Modèle principal + fallback

3. **Skills**
   - Choix preset (minimal/standard/developer/power/full)
   - Personnalisation optionnelle (checkbox multi-select)

4. **Personnalité**
   - Choix preset
   - Modification system prompt optionnelle

5. **Sécurité**
   - Choix preset (strict/balanced/permissive)
   - Personnalisation optionnelle:
     - Rate limits
     - Commandes shell autorisées
     - Langages code autorisés
     - Politique IPs privées

6. **Service Windows**
   - Installer comme service ? (oui/non)
   - Nom du service
   - Auto-start au boot

### Résumé Final

Tableau récapitulatif de toute la configuration avant confirmation.

---

## Commandes CLI

```bash
# Setup
novaclaw setup              # Wizard interactif
novaclaw setup --quick      # Mode rapide directement
novaclaw setup --reset      # Réinitialiser la config

# Runtime
novaclaw start              # Démarrer l'agent
novaclaw stop               # Arrêter l'agent
novaclaw status             # Statut actuel
novaclaw logs               # Voir les logs
novaclaw logs -f            # Follow logs

# Configuration
novaclaw config show        # Afficher la config
novaclaw config edit        # Ouvrir dans éditeur
novaclaw config set <key> <value>  # Modifier une valeur
novaclaw config get <key>   # Lire une valeur

# Skills
novaclaw skills list        # Lister les skills
novaclaw skills enable <name>   # Activer un skill
novaclaw skills disable <name>  # Désactiver un skill
novaclaw skills info <name>     # Détails d'un skill

# Service Windows
novaclaw service install    # Installer le service
novaclaw service uninstall  # Désinstaller
novaclaw service start      # Démarrer le service
novaclaw service stop       # Arrêter le service
novaclaw service status     # Statut du service

# Auth
novaclaw auth status        # Statut authentification
novaclaw auth login         # Re-login OAuth
novaclaw auth logout        # Déconnexion
```

---

## Fichiers à créer/modifier

### Nouveaux fichiers
- `src/cli/commands/setup-v2.ts` - Nouveau wizard complet
- `src/cli/commands/config.ts` - Commandes config
- `src/cli/commands/skills.ts` - Commandes skills
- `src/cli/commands/service.ts` - Commandes service Windows
- `src/cli/commands/auth.ts` - Commandes auth
- `src/config/schema.ts` - Schéma Zod pour novaclaw.json
- `src/config/loader.ts` - Chargement config JSON
- `src/config/defaults.ts` - Valeurs par défaut
- `src/auth/oauth.ts` - Flow OAuth Claude
- `src/skills/catalog.ts` - Catalogue des 42 skills

### Fichiers à modifier
- `src/cli/index.ts` - Ajouter nouvelles commandes
- `src/config.ts` - Adapter au nouveau format
- `src/index.ts` - Charger nouvelle config
- `package.json` - Scripts additionnels

---

## Dépendances additionnelles

```json
{
  "open": "^10.0.0",           // Ouvrir navigateur pour OAuth
  "conf": "^13.0.0",           // Stockage config cross-platform (optionnel)
  "node-windows": "^1.0.0"     // Service Windows (déjà installé)
}
```

---

## Tests

- [ ] Setup wizard mode rapide
- [ ] Setup wizard mode complet
- [ ] Validation token Telegram
- [ ] OAuth flow Claude
- [ ] API Key validation
- [ ] Génération novaclaw.json
- [ ] Génération credentials.json
- [ ] Installation service Windows
- [ ] Commandes CLI config/skills/service
- [ ] Migration depuis ancien format .env

---

## Migration

Pour les utilisateurs existants avec `.env`:
1. Détecter `.env` existant au lancement de `novaclaw setup`
2. Proposer migration automatique
3. Convertir vers nouveau format
4. Backup de l'ancien `.env` → `.env.backup`
