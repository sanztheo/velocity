# Velocity - TODO Commandes Backend

Commandes Tauri restantes à implémenter d'après le roadmap.

---

## 📊 MVP (Priorité haute)

### Connexion & Pool

- [ ] `test_connection` - Tester une connexion avant de sauvegarder
- [ ] `connect` - Établir une connexion active (pool)
- [ ] `disconnect` - Fermer une connexion active

### Navigation

- [ ] `list_databases` - Lister les bases de données disponibles
- [ ] `list_tables` - Lister les tables d'une database
- [ ] `get_table_schema` - Récupérer le schema (colonnes, types, PK, FK)

### Éditeur SQL

- [ ] `execute_query` - Exécuter une requête SQL et retourner les résultats
- [ ] `get_query_rows` - Récupérer les lignes d'une table avec pagination

---

## 🚀 V1 (Priorité moyenne)

### Navigation Avancée

- [ ] `list_views` - Lister les vues
- [ ] `list_functions` - Lister les fonctions/procédures
- [ ] `search_objects` - Recherche "Open Anything" (Cmd+K)

### Édition de Données

- [ ] `insert_row` - Insérer une nouvelle ligne
- [ ] `update_row` - Mettre à jour une ligne existante
- [ ] `delete_row` - Supprimer une ligne
- [ ] `preview_changes_sql` - Générer le SQL des changements pending

### SQL Avancé

- [ ] `execute_multi_statement` - Exécuter plusieurs statements séparés par ;
- [ ] `get_query_history` - Récupérer l'historique des requêtes
- [ ] `save_favorite_query` - Sauvegarder une requête favorite

### Filtrage

- [ ] `filter_table` - Appliquer des filtres sur une table

### Export

- [ ] `export_csv` - Exporter en CSV
- [ ] `export_json` - Exporter en JSON

### Sécurité

- [ ] `save_to_keychain` - Sauvegarder mot de passe dans le keychain

---

## 🔮 V2 (Priorité basse)

### Connexions

- [ ] `connect_ssh_tunnel` - Connexion via SSH tunnel

### Structure

- [ ] `create_table` - Créer une table via UI
- [ ] `alter_table` - Modifier une table
- [ ] `create_index` - Créer un index
- [ ] `drop_table` - Supprimer une table

### Import/Export

- [ ] `export_sql_dump` - Export SQL complet
- [ ] `import_csv` - Importer depuis CSV
- [ ] `import_sql` - Exécuter un fichier SQL

### SQL Avancé

- [ ] `explain_query` - Plan d'exécution d'une requête
- [ ] `format_sql` - Beautify SQL

---

## ✨ V2+ (Nice-to-have)

- [ ] `ai_generate_sql` - Génération SQL via LLM
- [ ] `schema_diff` - Comparer deux schemas
- [ ] `generate_erd` - Générer diagramme ERD

---

## 📁 Structure Fichiers Backend

```
src-tauri/src/
├── commands/
│   ├── mod.rs
│   ├── connections.rs    ✅ (load, save, delete)
│   ├── database.rs       ⏳ (connect, disconnect, list_databases)
│   ├── tables.rs         ⏳ (list_tables, get_schema)
│   ├── queries.rs        ⏳ (execute_query, history)
│   ├── data.rs           ⏳ (insert, update, delete rows)
│   └── export.rs         ⏳ (csv, json, sql)
├── db/
│   ├── mod.rs
│   ├── pool.rs           ⏳ (connection pool manager)
│   ├── postgres.rs       ⏳
│   ├── mysql.rs          ⏳
│   └── sqlite.rs         ⏳
└── ...
```

**Légende:** ✅ Fait | ⏳ À faire
