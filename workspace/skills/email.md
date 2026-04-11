---
name: email
description: Gerer les emails. Declencheur : email, mail, envoyer un email, lire mes emails, inbox, gmail, smtp, imap.
---

# Email

## Avec himalaya (CLI email)
Si `himalaya` est installe :
- `himalaya envelope list` — lister les emails recents
- `himalaya envelope list -f INBOX -s "from:user@example.com"` — rechercher
- `himalaya message read <id>` — lire un email
- `himalaya message write` — ecrire (interactif)
- `himalaya message reply <id>` — repondre
- `himalaya message forward <id>` — transferer

## Avec curl (API directe)
Pour Gmail API ou autre provider REST.

## Avec Python
```python
import smtplib
from email.mime.text import MIMEText
msg = MIMEText("Corps du message")
msg["Subject"] = "Sujet"
msg["From"] = "moi@example.com"
msg["To"] = "dest@example.com"
```

## Regles
- TOUJOURS confirmer le contenu et le destinataire avant d'envoyer
- Affiche un apercu du message avant envoi
- Ne lis jamais les emails sans que l'utilisateur le demande
