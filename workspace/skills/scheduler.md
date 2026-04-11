---
name: scheduler
description: Taches planifiees et cron jobs. Declencheur : cron, schedule, planifier, rappel, automatiser, toutes les X minutes, chaque jour, periodic.
---

# Taches Planifiees

## Linux (crontab)
- `crontab -l` — lister les jobs
- `crontab -e` — editer
- Format : `minute heure jour mois jour_semaine commande`
- Exemples :
  - `0 9 * * * /script.sh` — tous les jours a 9h
  - `*/5 * * * * /check.sh` — toutes les 5 minutes
  - `0 0 * * 0 /backup.sh` — chaque dimanche a minuit

## Windows (Task Scheduler)
- `schtasks /create /sc daily /tn "MonTask" /tr "commande" /st 09:00`
- `schtasks /query /tn "MonTask"`
- `schtasks /delete /tn "MonTask" /f`

## Regles
- Detecte l'OS avant de proposer cron ou schtasks
- Verifie que le script/commande existe avant de planifier
- Ajoute un log de sortie (`>> /var/log/task.log 2>&1`)
