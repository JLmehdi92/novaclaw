---
name: weather
description: Meteo et previsions. Declencheur : meteo, temps, temperature, pluie, neige, vent, forecast, weather.
requires: curl
---

# Meteo

Utilise wttr.in via curl. Pas besoin de cle API.

## Commandes
- `curl -s "wttr.in/Paris?format=%c+%t+%w+%h"` — meteo rapide (emoji + temp + vent + humidite)
- `curl -s "wttr.in/Paris?lang=fr"` — previsions completes en francais
- `curl -s "wttr.in/Paris?format=j1"` — JSON detaille
- `curl -s "wttr.in/Paris?1"` — previsions jour en cours uniquement

## Codes format
- `%c` emoji meteo, `%C` description, `%t` temperature, `%f` ressenti
- `%w` vent, `%h` humidite, `%p` precipitation, `%P` pression
- `%D` aube, `%S` lever soleil, `%s` coucher soleil

## Regles
- Reponds avec les infos principales (temp, ressenti, conditions), pas le dump complet
- Si la ville n'est pas precisee, demande
