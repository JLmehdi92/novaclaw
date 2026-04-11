---
name: file-manager
description: Gestion de fichiers et dossiers. Declencheur : fichier, dossier, copier, deplacer, supprimer, creer, lister, chercher, renommer, zip, archive, taille.
---

# Gestion de fichiers

## Operations courantes
- **Lister** : `ls -la <path>` ou explorer avec les outils Read/Glob
- **Chercher** : `find <path> -name "*.ext"` ou Grep pour le contenu
- **Creer** : ecrire directement avec l'outil Write
- **Copier/Deplacer** : `cp -r src dst` / `mv src dst`
- **Supprimer** : `rm -rf <path>` (mentionner que c'est irreversible)
- **Taille** : `du -sh <path>` pour un dossier, `ls -lh <file>` pour un fichier
- **Archive** : `tar -czf archive.tar.gz <dossier>` ou `zip -r archive.zip <dossier>`

## Regles
- Pour les suppressions, mentionne ce qui va etre supprime avant d'executer
- Pour les gros deplacements, verifie l'espace disque avec `df -h`
- Montre le resultat de l'operation (fichier cree, taille, etc.)
