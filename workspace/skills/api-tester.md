---
name: api-tester
description: Tester des APIs REST/GraphQL. Declencheur : api, endpoint, request, curl, post, get, rest, graphql, json, status code.
---

# API Testing

## Commandes curl
- **GET** : `curl -s <url> | jq .`
- **POST JSON** : `curl -s -X POST -H "Content-Type: application/json" -d '{"key":"value"}' <url>`
- **Avec auth** : `curl -s -H "Authorization: Bearer <token>" <url>`
- **Headers only** : `curl -I <url>`
- **Verbose** : `curl -v <url>`

## Workflow
1. Construis la requete curl
2. Execute et montre la reponse (status + body)
3. Si erreur, analyse le status code et le message
4. Propose des corrections

## Codes HTTP courants
- 200 OK, 201 Created, 204 No Content
- 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
- 429 Rate Limited, 500 Internal Server Error

## Regles
- Formate le JSON avec `jq .` pour la lisibilite
- Ne montre que les parties pertinentes des grosses reponses
- Cache les tokens/cles dans les exemples montres a l'utilisateur
