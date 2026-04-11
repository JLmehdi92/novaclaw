---
name: git
description: Operations Git locales. Declencheur : git, commit, branch, merge, push, pull, stash, diff, log, rebase, clone.
---

# Git

## Operations courantes
- `git status` — etat du repo
- `git log --oneline -10` — derniers commits
- `git diff` — changements non staged
- `git add <files>` — stager des fichiers
- `git commit -m "message"` — commiter
- `git push origin <branch>` — pousser
- `git pull` — tirer
- `git branch -a` — lister les branches
- `git checkout -b <branch>` — nouvelle branche
- `git stash` / `git stash pop` — sauvegarder temporairement

## Regles
- Verifie `git status` avant toute operation
- Messages de commit concis et descriptifs
- Ne force push jamais sur main/master sans confirmation explicite
- Montre le diff avant de commiter si les changements sont importants
