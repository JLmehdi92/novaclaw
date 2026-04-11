---
name: trello
description: Gerer des boards, listes et cartes Trello. Declencheur : trello, board, carte, kanban, liste, sprint.
requires: TRELLO_API_KEY, TRELLO_TOKEN
---

# Trello API

Utilise curl + jq pour interagir avec l'API Trello REST.

## Setup
- Cle API et token : trello.com/app-key
- Variables : `TRELLO_API_KEY` et `TRELLO_TOKEN`

## Operations courantes
```bash
# Lister les boards
curl -s "https://api.trello.com/1/members/me/boards?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" | jq '.[].name'

# Lister les cartes d'une liste
curl -s "https://api.trello.com/1/lists/{listId}/cards?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" | jq .

# Creer une carte
curl -s -X POST "https://api.trello.com/1/cards?idList={listId}&name=Ma+Carte&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"

# Deplacer une carte
curl -s -X PUT "https://api.trello.com/1/cards/{cardId}?idList={newListId}&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN"
```

## Rate limits
- 300 req/10s par API key, 100 req/10s par token
