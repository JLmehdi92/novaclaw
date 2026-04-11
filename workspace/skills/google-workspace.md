---
name: google-workspace
description: Gmail, Google Calendar, Drive, Sheets, Contacts. Declencheur : gmail, google calendar, drive, sheets, google docs, evenement, rendez-vous, spreadsheet.
requires: gog
---

# Google Workspace (via gog CLI)

## Setup
```bash
gog auth credentials /path/to/client_secret.json
gog auth add  # activer les services
```

## Gmail
- `gog gmail search "from:boss subject:urgent"` — chercher (threads)
- `gog gmail messages search "subject:facture"` — chercher (messages individuels)
- `gog gmail send --to user@example.com --subject "Sujet" --body "Message"` — envoyer
- `gog gmail reply --to thread_id --body "Reponse"` — repondre

## Calendar
- `gog calendar list` — evenements a venir
- `gog calendar create --title "Reunion" --start "2026-04-15T10:00:00" --end "2026-04-15T11:00:00"` — creer
- `gog calendar update <id> --title "Nouveau titre"` — modifier

## Drive
- `gog drive search "budget 2026"` — chercher des fichiers

## Sheets
- `gog sheets get <spreadsheet_id> <range>` — lire
- `gog sheets update <id> <range> --values '[["A","B"]]'` — ecrire
- `gog sheets append <id> <range> --values '[["new","row"]]'` — ajouter

## Regles
- Confirmer avant d'envoyer un email ou creer un evenement
- `--json` pour le traitement automatise
