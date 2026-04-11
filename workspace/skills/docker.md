---
name: docker
description: Gestion Docker et containers. Declencheur : docker, container, image, compose, dockerfile, build, run, logs.
requires: docker
---

# Docker

## Commandes courantes
- `docker ps` — containers actifs
- `docker ps -a` — tous les containers
- `docker images` — images disponibles
- `docker logs <container>` — logs
- `docker exec -it <container> sh` — shell dans un container
- `docker-compose up -d` — lancer un compose
- `docker-compose down` — arreter
- `docker build -t <name> .` — builder une image
- `docker system prune -f` — nettoyer

## Regles
- Verifie que Docker est installe et le daemon tourne avant d'operer
- Pour les `docker system prune`, mentionne ce qui sera supprime
