---
name: notion
description: API Notion pour creer et gerer des pages, bases de donnees et blocs. Declencheur : notion, page, database, workspace notion, note.
requires: NOTION_API_KEY
---

# Notion API

Utilise curl pour interagir avec l'API Notion.

## Setup
1. Creer une integration sur notion.so/my-integrations
2. Copier la cle API (commence par `ntn_` ou `secret_`)
3. Partager les pages/databases avec l'integration

## Requetes (toujours inclure ces headers)
```bash
curl -s https://api.notion.com/v1/... \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json"
```

## Operations courantes
- **Recherche** : `POST /v1/search` avec `{"query": "terme"}`
- **Lire une page** : `GET /v1/pages/{page_id}`
- **Contenu d'une page** : `GET /v1/blocks/{page_id}/children`
- **Creer une page** : `POST /v1/pages` avec parent + properties
- **Requeter une database** : `POST /v1/databases/{db_id}/query`

## Regles
- Rate limit : ~3 requetes/seconde
- Max 1000 blocs par requete
- Formate les resultats en resume lisible, pas en JSON brut
