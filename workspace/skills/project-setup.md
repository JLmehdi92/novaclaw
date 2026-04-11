---
name: project-setup
description: Creer et initialiser des projets. Declencheur : creer un projet, nouveau projet, init, starter, boilerplate, template, setup projet.
---

# Creation de Projets

## Templates rapides
- **Node/TypeScript** : `npm init -y && npm i -D typescript @types/node && npx tsc --init`
- **React** : `npx create-react-app <name>` ou `npm create vite@latest <name> -- --template react-ts`
- **Next.js** : `npx create-next-app@latest <name>`
- **Python** : `mkdir <name> && cd <name> && python -m venv venv && source venv/bin/activate`
- **Express API** : `npm init -y && npm i express cors dotenv`

## Workflow
1. Creer le dossier et initialiser
2. Installer les dependances
3. Creer la structure de dossiers (src/, tests/, etc.)
4. Initialiser git
5. Creer un .gitignore adapte
6. Creer un README.md basique

## Regles
- Demande le type de projet et le langage si pas precise
- Utilise TypeScript par defaut pour les projets Node
- Ajoute toujours un .gitignore adapte
