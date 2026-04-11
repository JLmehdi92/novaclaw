---
name: security-audit
description: Audit de securite et hardening. Declencheur : securite, audit, vulnerability, firewall, ssl, https, password, permission, hardening.
---

# Audit de Securite

## Checklist rapide
1. **OS a jour** : `apt update && apt list --upgradable` (Linux) ou `winget upgrade --all` (Windows)
2. **Ports ouverts** : `ss -tlnp` / `netstat -an | findstr LISTENING`
3. **Firewall** : `ufw status` (Linux) ou `netsh advfirewall show allprofiles` (Windows)
4. **SSL/HTTPS** : `curl -vI https://<domain>` pour verifier le certificat
5. **Permissions fichiers** : chercher les fichiers world-readable sensibles
6. **Processus suspects** : `ps aux` / `tasklist` et identifier les inconnus
7. **Logs** : verifier les tentatives de connexion recentes

## Regles
- Presente les resultats avec un niveau de risque (critique, moyen, faible)
- Propose des actions correctives pour chaque probleme
- Ne modifie rien sans confirmation explicite
