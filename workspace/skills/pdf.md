---
name: pdf
description: Lire et editer des PDFs. Declencheur : pdf, document pdf, lire un pdf, modifier un pdf, extraire du texte.
---

# PDF

## Lire un PDF
Si `nano-pdf` est installe :
```bash
nano-pdf read document.pdf
```
Sinon avec Python :
```bash
python3 -c "
import subprocess
result = subprocess.run(['python3', '-m', 'PyPDF2', 'document.pdf'], capture_output=True)
"
```
Ou simplement avec les outils integres (Read supporte les PDFs).

## Editer un PDF
Avec `nano-pdf` :
```bash
nano-pdf edit document.pdf 1 "Change le titre en 'Rapport Q3' et corrige la faute dans le sous-titre"
```

## Regles
- Verifie toujours le resultat apres edition
- Les numeros de page peuvent etre 0-based ou 1-based selon la version
