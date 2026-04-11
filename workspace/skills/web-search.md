---
name: web-search
description: Recherche web, scraping, lecture de pages. Declencheur : cherche, recherche, google, trouve, url, site web, article, lien.
---

# Recherche Web

## Strategies
1. **Recherche rapide** : utilise l'outil WebSearch integre si disponible
2. **Scraping** : `curl -s <url>` pour recuperer le contenu brut
3. **Lecture de page** : `curl -s <url> | head -200` pour un apercu

## Regles
- Donne un resume des resultats, pas le HTML brut
- Cite les sources avec les URLs
- Si plusieurs resultats, presente les 3-5 plus pertinents
- Pour les pages longues, extrais l'info demandee plutot que tout copier
