## 6. Fonctionnalités - Roadmap Complète TablePlus

### 6.1 Feature Matrix Complète

> Comparaison avec toutes les fonctionnalités TablePlus, organisées par catégorie.

#### 🔌 Connexions et Bases Supportées

| Fonctionnalité                | TablePlus | MVP | V1  | V2  | Notes                 |
| ----------------------------- | --------- | --- | --- | --- | --------------------- |
| MySQL                         | ✅        | ✅  | ✅  | ✅  | Via sqlx              |
| PostgreSQL                    | ✅        | ✅  | ✅  | ✅  | Via sqlx              |
| SQLite                        | ✅        | ✅  | ✅  | ✅  | Via sqlx              |
| MariaDB                       | ✅        | ❌  | ✅  | ✅  | Même driver MySQL     |
| Microsoft SQL Server          | ✅        | ❌  | ❌  | ✅  | tiberius crate        |
| Redis                         | ✅        | ❌  | ❌  | V2+ | redis-rs crate        |
| CockroachDB                   | ✅        | ❌  | ❌  | V2+ | Compatible PostgreSQL |
| Redshift                      | ✅        | ❌  | ❌  | V2+ | Compatible PostgreSQL |
| Vertica                       | ✅        | ❌  | ❌  | V2+ | ODBC driver           |
| Multi-connexions simultanées  | ✅        | ✅  | ✅  | ✅  | Pool manager          |
| Multi-onglets/fenêtres        | ✅        | ✅  | ✅  | ✅  | Tab system            |
| SSL/TLS                       | ✅        | ✅  | ✅  | ✅  | Config par connexion  |
| SSH Tunnel                    | ✅        | ❌  | ✅  | ✅  | russh crate           |
| Persistence connexions (JSON) | ✅        | ✅  | ✅  | ✅  | AppData config        |
| Keychain/Credential Manager   | ✅        | ❌  | ✅  | ✅  | tauri-plugin-keyring  |

#### 🗂️ Navigation et Exploration

| Fonctionnalité                   | TablePlus | MVP | V1  | V2  | Notes           |
| -------------------------------- | --------- | --- | --- | --- | --------------- |
| Liste databases                  | ✅        | ✅  | ✅  | ✅  |                 |
| Liste tables                     | ✅        | ✅  | ✅  | ✅  |                 |
| Liste vues                       | ✅        | ❌  | ✅  | ✅  |                 |
| Liste fonctions                  | ✅        | ❌  | ✅  | ✅  |                 |
| Liste colonnes/indexes           | ✅        | ✅  | ✅  | ✅  | Schema explorer |
| Sidebar avec tree view           | ✅        | ✅  | ✅  | ✅  |                 |
| Recherche rapide "Open Anything" | ✅        | ❌  | ✅  | ✅  | Cmd+K           |
| Preview relations/FK             | ✅        | ❌  | ❌  | ✅  |                 |

#### ✏️ Édition de Données

| Fonctionnalité                 | TablePlus | MVP | V1  | V2  | Notes          |
| ------------------------------ | --------- | --- | --- | --- | -------------- |
| Vue grille (spreadsheet)       | ✅        | ✅  | ✅  | ✅  | TanStack Table |
| Édition inline cellules        | ✅        | ❌  | ✅  | ✅  |                |
| Ajout de lignes                | ✅        | ❌  | ✅  | ✅  |                |
| Suppression de lignes          | ✅        | ❌  | ✅  | ✅  |                |
| Commit explicite (Cmd+S)       | ✅        | ❌  | ✅  | ✅  |                |
| Rollback/Annuler changements   | ✅        | ❌  | ✅  | ✅  |                |
| Aperçu SQL généré              | ✅        | ❌  | ✅  | ✅  | Modal preview  |
| Couleurs pour types de données | ✅        | ❌  | ✅  | ✅  |                |
| NULL handling visuel           | ✅        | ✅  | ✅  | ✅  | Badge spécial  |

#### 🖥️ Éditeur SQL

| Fonctionnalité              | TablePlus | MVP | V1  | V2  | Notes         |
| --------------------------- | --------- | --- | --- | --- | ------------- |
| Éditeur SQL                 | ✅        | ✅  | ✅  | ✅  | CodeMirror    |
| Coloration syntaxique       | ✅        | ✅  | ✅  | ✅  | lang-sql      |
| Auto-complétion tables      | ✅        | ❌  | ✅  | ✅  |               |
| Auto-complétion colonnes    | ✅        | ❌  | ✅  | ✅  |               |
| Auto-complétion mots-clés   | ✅        | ❌  | ✅  | ✅  |               |
| Exécution query (Cmd+Enter) | ✅        | ✅  | ✅  | ✅  |               |
| Exécution multi-statements  | ✅        | ❌  | ✅  | ✅  | Split par ;   |
| Résultats en onglets        | ✅        | ✅  | ✅  | ✅  |               |
| Historique requêtes         | ✅        | ❌  | ✅  | ✅  | Stocké JSON   |
| Requêtes favorites          | ✅        | ❌  | ✅  | ✅  |               |
| Format/Beautify SQL         | ✅        | ❌  | ❌  | ✅  | sql-formatter |
| Explain query plan          | ✅        | ❌  | ❌  | ✅  |               |

#### 🔍 Filtrage et Recherche

| Fonctionnalité             | TablePlus | MVP | V1  | V2  | Notes       |
| -------------------------- | --------- | --- | --- | --- | ----------- |
| Tri colonnes (clic header) | ✅        | ✅  | ✅  | ✅  |             |
| Filtre égalité (=)         | ✅        | ❌  | ✅  | ✅  |             |
| Filtre contient (LIKE)     | ✅        | ❌  | ✅  | ✅  |             |
| Filtre IS NULL             | ✅        | ❌  | ✅  | ✅  |             |
| Filtre IN (...)            | ✅        | ❌  | ❌  | ✅  |             |
| Filtres combinés (AND/OR)  | ✅        | ❌  | ❌  | ✅  |             |
| Pagination                 | ✅        | ✅  | ✅  | ✅  | Server-side |
| Jump to page               | ✅        | ❌  | ✅  | ✅  |             |
| Rows per page config       | ✅        | ✅  | ✅  | ✅  |             |

#### 🏗️ Gestion de Structure

| Fonctionnalité                | TablePlus | MVP | V1  | V2  | Notes          |
| ----------------------------- | --------- | --- | --- | --- | -------------- |
| Voir schema table             | ✅        | ✅  | ✅  | ✅  |                |
| Créer table (UI)              | ✅        | ❌  | ❌  | ✅  |                |
| Modifier colonnes (UI)        | ✅        | ❌  | ❌  | ✅  |                |
| Ajouter/supprimer colonnes    | ✅        | ❌  | ❌  | ✅  |                |
| Créer/modifier indexes        | ✅        | ❌  | ❌  | ✅  |                |
| Créer/modifier contraintes FK | ✅        | ❌  | ❌  | ✅  |                |
| ERD / Diagramme relations     | ✅        | ❌  | ❌  | V2+ | D3.js ou dagre |

#### 📥 Import / Export

| Fonctionnalité          | TablePlus | MVP | V1  | V2  | Notes              |
| ----------------------- | --------- | --- | --- | --- | ------------------ |
| Export CSV              | ✅        | ❌  | ✅  | ✅  |                    |
| Export JSON             | ✅        | ❌  | ✅  | ✅  |                    |
| Export SQL dump         | ✅        | ❌  | ❌  | ✅  | pg_dump, mysqldump |
| Export Excel            | ✅        | ❌  | ❌  | V2+ | xlsx crate         |
| Import CSV              | ✅        | ❌  | ❌  | ✅  |                    |
| Import SQL              | ✅        | ❌  | ❌  | ✅  |                    |
| Mapping colonnes import | ✅        | ❌  | ❌  | ✅  |                    |

#### 🔐 Sécurité et Fiabilité

| Fonctionnalité           | TablePlus | MVP | V1  | V2  | Notes        |
| ------------------------ | --------- | --- | --- | --- | ------------ |
| Aperçu SQL avant apply   | ✅        | ❌  | ✅  | ✅  |              |
| Transactions explicites  | ✅        | ❌  | ✅  | ✅  |              |
| Rollback en cas d'erreur | ✅        | ❌  | ✅  | ✅  |              |
| Confirmation delete      | ✅        | ✅  | ✅  | ✅  | Dialog       |
| Read-only mode           | ✅        | ❌  | ❌  | ✅  |              |
| Timeout requêtes         | ✅        | ✅  | ✅  | ✅  | Configurable |

#### 🎨 UX et Productivité

| Fonctionnalité            | TablePlus | MVP | V1  | V2  | Notes         |
| ------------------------- | --------- | --- | --- | --- | ------------- |
| Interface native          | ✅        | ✅  | ✅  | ✅  | Tauri         |
| Dark mode                 | ✅        | ✅  | ✅  | ✅  |               |
| Light mode                | ✅        | ✅  | ✅  | ✅  |               |
| Thèmes custom             | ✅        | ❌  | ❌  | V2+ |               |
| Raccourcis clavier        | ✅        | ✅  | ✅  | ✅  |               |
| Connexions favorites      | ✅        | ✅  | ✅  | ✅  | Star toggle   |
| Couleurs connexions       | ✅        | ✅  | ✅  | ✅  | Badge couleur |
| Context menu (clic droit) | ✅        | ✅  | ✅  | ✅  |               |
| Vues sauvegardées         | ✅        | ❌  | ❌  | ✅  |               |
| Colonnes visibles toggle  | ✅        | ❌  | ✅  | ✅  |               |
| Resize colonnes           | ✅        | ✅  | ✅  | ✅  |               |
| Copy cell/row             | ✅        | ❌  | ✅  | ✅  |               |

### 6.2 Résumé Progression

| Phase   | Fonctionnalités             | % TablePlus |
| ------- | --------------------------- | ----------- |
| **MVP** | 35 features                 | ~40%        |
| **V1**  | +45 features                | ~75%        |
| **V2**  | +25 features                | ~95%        |
| **V2+** | Extras (Redis, themes, ERD) | 100%+       |

### 6.3 Fonctionnalités Velocity Uniques (différenciation)

Ces features ne sont pas dans TablePlus mais pourraient être ajoutées :
| Feature | Description | Phase |
|---------|-------------|-------|
| AI SQL Assistant | Génération de requêtes via LLM | V2+ |
| Query explain visuel | Visualisation graphique du plan | V2+ |
| Collaboration temps réel | Partage de queries en équipe | V2+ |
| Plugin system | Extensions communautaires | V2+ |
| Schema diff | Comparer schemas entre 2 DB | V2+ |

### 6.4 Gestion des onglets

Chaque onglet représente un contexte de travail :

- **Type `query`** : Éditeur SQL libre + résultats
- **Type `table`** : Vue données d'une table spécifique
- **Type `structure`** : Schema/colonnes/indexes d'une table
  État persisté par tab :
- `connectionId` → quelle DB
- `sql` (si query) → contenu éditeur
- `tableName` (si table/structure)
- `pagination` → page actuelle, tri

### 6.3 Historique et favoris

```typescript
// Stocké dans le JSON avec les connexions
interface QueryHistoryEntry {
  connectionId: string;
  sql: string;
  executedAt: string; // ISO date
}
interface FavoriteQuery {
  id: string;
  name: string;
  connectionId: string;
  sql: string;
}
```
