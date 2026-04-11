# 🦾 NovaClaw

**L'assistant IA personnel qui fait vraiment les choses.** Il tourne sur ta machine, repond sur Telegram, utilise ton abonnement Claude Code.

Inspire par [OpenClaw](https://github.com/openclaw/openclaw) — meme philosophie, meme intelligence, mais en utilisant ton abonnement Claude Code (pas de cle API separee).

---

## Fonctionnalites

- **Agent SDK** — utilise `@anthropic-ai/claude-agent-sdk` pour spawn Claude Code avec ton abonnement
- **Personnalite** — SOUL.md definit qui est NovaClaw (pas un chatbot generique)
- **Memoire persistante** — MEMORY.md + notes journalieres, survit entre les sessions
- **12+ skills** — github, git, weather, coding, docker, database, admin systeme, et plus
- **Execution bias** — agit d'abord, commente ensuite (pas juste du blabla)
- **Multi-tour** — conversations continues via session resume
- **Acces complet** — fichiers, shell, web, code, git — bypass permissions
- **Workspace dedie** — CLAUDE.md, SOUL.md, IDENTITY.md, USER.md (comme OpenClaw)
- **Telegram** — via grammY, avec Markdown, typing indicators, commandes

---

## Quick Start (5 minutes)

### Pre-requis
- Node.js >= 22
- Claude Code installe et authentifie (`npm install -g @anthropic-ai/claude-code && claude`)
- Un token Telegram Bot (via [@BotFather](https://t.me/BotFather))

### Installation

```bash
git clone https://github.com/JLmehdi92/novaclaw.git
cd novaclaw
npm install
```

### Configuration

```bash
novaclaw setup
```

Le wizard te guide pour :
1. Token Telegram
2. ID utilisateur autorise
3. Modele Claude (sonnet, opus)
4. Langue (fr/en)

### Permissions Claude Code

```bash
# Linux/macOS
mkdir -p ~/.claude && cat > ~/.claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": ["Bash(*)","Read(*)","Write(*)","Edit(*)","Glob(*)","Grep(*)","WebSearch(*)","WebFetch(*)"],
    "defaultMode": "bypassPermissions"
  },
  "allowDangerouslySkipPermissions": true
}
EOF
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude" | Out-Null
Set-Content -Path "$env:USERPROFILE\.claude\settings.json" -Value '{"permissions":{"allow":["Bash(*)","Read(*)","Write(*)","Edit(*)","Glob(*)","Grep(*)","WebSearch(*)","WebFetch(*)"],"defaultMode":"bypassPermissions"},"allowDangerouslySkipPermissions":true}'
```

### Lancer

```bash
npm start
```

---

## Architecture

```
Telegram --> grammy Bot --> Agent SDK query() --> Claude Code (OAuth)
                                 |
                       ~/.novaclaw/workspace/
                       ├── CLAUDE.md        (instructions agent)
                       ├── SOUL.md          (personnalite)
                       ├── IDENTITY.md      (nom, emoji, vibe)
                       ├── USER.md          (infos proprietaire)
                       ├── TOOLS.md         (outils locaux)
                       ├── MEMORY.md        (memoire long-terme)
                       ├── BOOTSTRAP.md     (premier lancement)
                       ├── memory/          (notes journalieres)
                       ├── skills/          (skills disponibles)
                       └── .claude/
                           └── settings.json (permissions projet)
```

## Workspace

NovaClaw utilise un workspace dedie (inspire d'OpenClaw) pour definir son identite et ses capacites :

| Fichier | Role |
|---------|------|
| `SOUL.md` | Personnalite, ton, limites — lu a chaque session |
| `IDENTITY.md` | Nom, emoji, vibe |
| `USER.md` | Infos sur le proprietaire — rempli par NovaClaw |
| `CLAUDE.md` | Instructions operationnelles, biais d'execution, skills |
| `MEMORY.md` | Memoire long-terme persistante |
| `memory/YYYY-MM-DD.md` | Notes journalieres |
| `TOOLS.md` | Notes sur les outils installes localement |
| `BOOTSTRAP.md` | Rituel de premier lancement (supprime apres) |
| `skills/*.md` | Skills disponibles (progressive disclosure) |

## Skills

Les skills sont des fichiers Markdown dans `workspace/skills/`. NovaClaw les scanne avant chaque reponse et charge celui qui correspond.

| Skill | Declencheur |
|-------|-------------|
| `github.md` | repos, issues, PRs, CI |
| `git.md` | commit, branch, push, merge |
| `weather.md` | meteo, temperature, previsions |
| `coding.md` | code, bug, debug, refactor |
| `file-manager.md` | fichiers, dossiers, copier, supprimer |
| `system-admin.md` | processus, memoire, services, reseau |
| `docker.md` | containers, images, compose |
| `database.md` | SQL, Redis, MongoDB |
| `web-search.md` | recherche, scraping, URLs |
| `project-setup.md` | nouveau projet, init, template |
| `security-audit.md` | securite, firewall, SSL |
| `api-tester.md` | API, curl, endpoints |
| `scheduler.md` | cron, taches planifiees |

### Creer un skill

```bash
mkdir -p ~/.novaclaw/workspace/skills/
```

Puis cree un fichier `mon-skill.md` :

```yaml
---
name: mon-skill
description: Description qui sert de declencheur automatique.
requires: curl
---

# Instructions detaillees ici
```

## Commandes Telegram

| Commande | Description |
|----------|-------------|
| `/start` | Premier contact |
| `/reset` | Nouvelle conversation |
| `/model` | Changer de modele Claude |
| `/status` | Etat du bot |
| `/skills` | Lister les skills actifs |

## Mise a jour

Sur le VPS :

```bash
novaclaw update
```

Ou manuellement :

```bash
git pull && npm install && npm run build
```

---

## Credits

- Inspire par [OpenClaw](https://github.com/openclaw/openclaw) — l'architecture workspace/skills/SOUL.md
- Propulse par [Claude Code](https://claude.ai/code) via le Agent SDK
- Bot Telegram via [grammY](https://grammy.dev)

---

*NovaClaw — L'assistant IA qui fait vraiment les choses.* 🦾
