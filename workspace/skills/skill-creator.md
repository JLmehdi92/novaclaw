---
name: skill-creator
description: Creer, editer et ameliorer des skills NovaClaw. Declencheur : creer un skill, nouveau skill, ajouter une competence, modifier un skill.
---

# Creation de Skills

## Structure d'un skill
Chaque skill est un fichier `.md` dans `skills/` avec :

```yaml
---
name: mon-skill
description: Ce que fait le skill et quand l'utiliser. C'est le DECLENCHEUR.
requires: curl  # optionnel : binaire necessaire
---

# Instructions detaillees
(le contenu n'est lu que quand le skill est active)
```

## Principes
1. **La description EST le trigger** — elle doit lister les mots-cles qui activent le skill
2. **Concis** — le body ne devrait pas depasser 200 lignes
3. **Actionnable** — des commandes concretes, pas de la theorie
4. **Un skill = un domaine** — ne pas melanger plusieurs sujets

## Workflow de creation
1. Comprendre ce que l'utilisateur veut automatiser
2. Creer le fichier dans `~/.novaclaw/workspace/skills/`
3. Ecrire le frontmatter (name + description avec mots-cles)
4. Ecrire les instructions (commandes, exemples, regles)
5. Tester en demandant quelque chose qui devrait activer le skill

## Exemples de bonnes descriptions
- "Gerer les containers Docker. Declencheur : docker, container, image, compose."
- "Meteo et previsions. Declencheur : meteo, temps, temperature, pluie."
- "Tester des APIs REST. Declencheur : api, endpoint, curl, request, json."
