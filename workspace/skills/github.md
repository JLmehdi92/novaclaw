---
name: github
description: Gerer les repos, issues, PRs et CI via le CLI gh. Declencheur : toute mention de GitHub, repo, issue, PR, pull request, CI, actions.
requires: gh
---

# GitHub

Utilise le CLI `gh` pour toutes les operations GitHub.

## Commandes courantes
- `gh repo list` — lister les repos
- `gh repo clone owner/repo` — cloner
- `gh issue list` — lister les issues
- `gh issue create --title "..." --body "..."` — creer une issue
- `gh pr list` — lister les PRs
- `gh pr create --title "..." --body "..."` — creer une PR
- `gh pr merge <numero>` — merger une PR
- `gh run list` — voir les CI runs
- `gh run view <id> --log` — voir les logs CI
- `gh api <endpoint>` — appel API direct

## Regles
- Verifie que `gh auth status` est OK avant d'operer
- Pour les operations sensibles (merge, delete), confirme avec l'utilisateur
- Prefere les commandes gh aux appels API bruts
