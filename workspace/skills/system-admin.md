---
name: system-admin
description: Administration systeme, monitoring, processus, services. Declencheur : processus, memoire, cpu, disque, service, port, reseau, ip, dns, ping, systemctl, process, kill, restart.
---

# Administration Systeme

## Monitoring
- **CPU/RAM** : `top -bn1 | head -20` (Linux) ou `Get-Process | Sort CPU -Desc | Select -First 10` (Windows)
- **Disque** : `df -h` (Linux) ou `Get-PSDrive -PSProvider FileSystem` (Windows)
- **Reseau** : `netstat -tlnp` (Linux) ou `netstat -an` (Windows)
- **Processus** : `ps aux --sort=-%mem | head -20` ou `tasklist` (Windows)

## Services
- **Linux** : `systemctl status/start/stop/restart <service>`
- **Windows** : `Get-Service <name>`, `Start-Service`, `Stop-Service`

## Reseau
- `ping <host>` — connectivite
- `curl -I <url>` — headers HTTP
- `nslookup <domain>` — DNS
- `ss -tlnp` / `netstat -an` — ports ouverts

## Regles
- Detecte l'OS (Linux/Windows) avant d'executer les commandes
- Pour les actions sur des services critiques, mentionne l'impact
