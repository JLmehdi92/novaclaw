---
name: database
description: Bases de donnees SQL et NoSQL. Declencheur : database, sql, query, table, select, insert, mongodb, postgres, mysql, sqlite, redis, supabase.
---

# Database

## SQLite
- `sqlite3 <file.db> ".tables"` — lister les tables
- `sqlite3 <file.db> ".schema <table>"` — schema
- `sqlite3 <file.db> "SELECT * FROM <table> LIMIT 10"` — requete

## PostgreSQL
- `psql -U <user> -d <db> -c "SELECT ..."` — requete directe
- `psql -U <user> -l` — lister les databases

## MySQL
- `mysql -u <user> -p -e "SELECT ..." <db>` — requete directe

## Redis
- `redis-cli ping` — test connexion
- `redis-cli keys "*"` — lister les cles

## Regles
- Fais un SELECT avant un UPDATE/DELETE pour verifier ce qui sera affecte
- Propose un backup avant les migrations destructives
- Montre les resultats en tableau lisible
