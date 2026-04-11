---
name: summarize
description: Resumer des pages web, articles, videos YouTube, fichiers. Declencheur : resume, summarize, tldr, recapitulatif, en bref, condense, article, youtube transcript.
---

# Resumer du contenu

## Pages web
```bash
curl -s "<url>" | head -500
```
Puis extrais l'info principale et fais un resume structure.

## Fichiers locaux
Lis le fichier et produis un resume avec les points cles.

## YouTube
Si `summarize` CLI est installe :
```bash
summarize "<youtube_url>" --youtube auto --extract-only
```
Sinon, utilise `curl` pour chercher des transcripts ou des resumes existants.

## Format de sortie
- **En-tete** : titre/source
- **Points cles** : 3-5 bullet points
- **Detail** : si demande, section plus longue

## Regles
- Garde les resumes concis par defaut (5-10 lignes)
- Si l'utilisateur veut plus de detail, developpe
- Cite toujours la source
