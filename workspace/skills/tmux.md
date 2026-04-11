---
name: tmux
description: Controler des sessions tmux pour les CLI interactives. Declencheur : tmux, session, terminal, process background, worker.
requires: tmux
---

# tmux

Controle les sessions tmux en envoyant des touches et lisant la sortie.

## Quand utiliser
- CLI interactives qui ont besoin d'un TTY
- Processus long en background
- Monitorer plusieurs taches en parallele

## Commandes courantes
- `tmux ls` — lister les sessions
- `tmux new -d -s worker` — creer une session detachee
- `tmux send-keys -t worker "commande" Enter` — envoyer une commande
- `tmux capture-pane -t worker -p | tail -20` — lire la sortie
- `tmux capture-pane -t worker -p -S -` — tout le scrollback
- `tmux kill-session -t worker` — fermer une session

## Envoyer du texte de maniere sure
Separer le texte et Enter avec un sleep entre les deux :
```bash
tmux send-keys -t session "ma commande" && sleep 0.1 && tmux send-keys -t session Enter
```

## Regles
- Format cible : `session:window.pane`
- Les sessions persistent apres deconnexion SSH
- `-p` imprime vers stdout (essentiel pour capturer la sortie)
