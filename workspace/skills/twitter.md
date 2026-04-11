---
name: twitter
description: Poster, lire et interagir sur X/Twitter. Declencheur : twitter, tweet, x.com, poster un tweet, timeline, mention, DM twitter.
requires: xurl
---

# X / Twitter (via xurl)

## Commandes rapides
- `xurl post "Mon tweet"` — poster
- `xurl post "Tweet" --media photo.jpg` — avec image
- `xurl reply <tweet_id> "Reponse"` — repondre
- `xurl search "terme"` — chercher
- `xurl timeline` — timeline
- `xurl mentions` — mentions
- `xurl whoami` — infos du compte
- `xurl dm send <user_id> "Message"` — DM

## Regles de securite
- Ne JAMAIS lire ou afficher `~/.xurl` (contient les tokens)
- Ne JAMAIS utiliser `--verbose` (affiche les secrets)
- TOUJOURS confirmer le contenu avant de poster
- Montrer un apercu du tweet avant envoi
