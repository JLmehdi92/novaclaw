# Installation NovaClaw — Guide complet

## C'est quoi NovaClaw ?

NovaClaw est un assistant IA personnel sur Telegram. Il tourne sur ta machine (PC ou VPS), utilise ton abonnement Claude Code, et peut faire tout ce qu'un dev ferait : coder, gerer des fichiers, executer des commandes, chercher sur le web, etc.

---

## Pre-requis

1. **Node.js** version 22 ou plus → [nodejs.org](https://nodejs.org)
2. **Git** → [git-scm.com](https://git-scm.com)
3. **Un abonnement Claude** (Pro ou Max) → [claude.ai](https://claude.ai)
4. **Claude Code** installe → voir etape 1

---

## Etape 1 : Installer Claude Code

Ouvre PowerShell (ou Terminal) et lance :

```powershell
npm install -g @anthropic-ai/claude-code
```

Puis connecte-toi a ton compte Claude :

```powershell
claude
```

Ca va ouvrir un navigateur pour te connecter. Une fois connecte, ferme Claude Code avec `Ctrl+C`.

Pour verifier que ca marche :

```powershell
claude -p "dis bonjour"
```

Si ca repond, c'est bon.

---

## Etape 2 : Cloner NovaClaw

```powershell
cd C:\Users\TON_NOM
git clone https://github.com/JLmehdi92/novaclaw.git
cd novaclaw
npm install
```

---

## Etape 3 : Creer ton bot Telegram

1. Ouvre Telegram et cherche **@BotFather**
2. Envoie `/newbot`
3. Choisis un nom (ex: "Mon Assistant")
4. Choisis un username (ex: `mon_assistant_bot`)
5. BotFather te donne un **token** qui ressemble a : `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
6. **Copie ce token**, tu en auras besoin

---

## Etape 4 : Trouver ton Telegram User ID

1. Ouvre Telegram et cherche **@userinfobot**
2. Envoie `/start`
3. Il te repond avec ton **ID** (un nombre comme `935315895`)
4. **Note ce nombre**

---

## Etape 5 : Configurer NovaClaw

```powershell
novaclaw setup
```

Le wizard te demande :
1. **Bot Token** → colle le token de BotFather
2. **Ton User ID** → le nombre de @userinfobot
3. **Authentification** → choisis "Claude Code OAuth"
4. **Langue** → Francais
5. **Modele** → Claude Sonnet 4.6 (recommande)

Le setup configure tout automatiquement (permissions Claude Code incluses).

---

## Etape 6 : Lancer NovaClaw

```powershell
novaclaw start
```

Tu devrais voir :

```
  NovaClaw is running!
  Press Ctrl+C to stop
```

---

## Etape 7 : Tester

Ouvre Telegram, trouve ton bot, et envoie-lui un message !

Au premier message, NovaClaw va se presenter et te demander ton prenom (c'est le bootstrap — il apprend a te connaitre).

### Exemples de choses a demander :

- "Qui es-tu ?"
- "Quelle est la meteo a Paris ?"
- "Cree un fichier test.txt sur le bureau avec ecrit hello"
- "Liste les fichiers dans C:\Users"
- "Installe express dans un nouveau projet Node"

---

## Mettre a jour NovaClaw

Quand il y a une mise a jour :

```powershell
cd C:\Users\TON_NOM\novaclaw
novaclaw update
```

Ou manuellement :

```powershell
git pull
npm install
npm run build
```

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `novaclaw setup` | Reconfigurer |
| `novaclaw start` | Lancer le bot |
| `novaclaw update` | Mettre a jour |
| `novaclaw status` | Voir l'etat |

## Commandes Telegram

| Commande | Description |
|----------|-------------|
| `/start` | Premier contact |
| `/reset` | Nouvelle conversation |
| `/model` | Changer de modele |
| `/status` | Etat du bot |
| `/skills` | Voir les skills |

---

## En cas de probleme

### "Claude CLI non trouve"
```powershell
npm install -g @anthropic-ai/claude-code
```

### "Token invalide"
Verifie ton token Telegram aupres de @BotFather.

### Le bot ne repond pas
1. Verifie que `novaclaw start` tourne dans PowerShell
2. Verifie que ton User ID est dans la liste autorisee
3. Verifie que Claude Code marche : `claude -p "test"`

### "Permission denied" ou le bot demande des permissions
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude" | Out-Null
Set-Content -Path "$env:USERPROFILE\.claude\settings.json" -Value '{"permissions":{"allow":["Bash(*)","Read(*)","Write(*)","Edit(*)","Glob(*)","Grep(*)","WebSearch(*)","WebFetch(*)"],"defaultMode":"bypassPermissions"},"allowDangerouslySkipPermissions":true}'
```

---

## Architecture

```
Telegram → NovaClaw Bot → Claude Code (ton abonnement)
                |
      ~/.novaclaw/workspace/
      ├── SOUL.md         (personnalite du bot)
      ├── IDENTITY.md     (nom, emoji)
      ├── USER.md         (tes infos — auto-rempli)
      ├── MEMORY.md       (memoire persistante)
      ├── CLAUDE.md       (instructions de l'agent)
      └── skills/         (53 skills : github, weather, docker...)
```

NovaClaw utilise ton abonnement Claude (Pro/Max) via Claude Code. Pas besoin de cle API separee — ca marche avec le meme compte que sur claude.ai.

---

*Guide par NovaClaw Team — Avril 2026*
