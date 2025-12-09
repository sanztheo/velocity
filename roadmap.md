## 6. Fonctionnalités - Roadmap Complète TablePlus

### 6.1 Feature Matrix Complète

> Comparaison avec toutes les fonctionnalités TablePlus, organisées par catégorie.

**Légende Status:** ✅ Fait | 🔄 En cours | ❌ À faire

#### 🔌 Connexions et Bases Supportées

| Fonctionnalité                | TablePlus | Status | Notes                 |
| ----------------------------- | --------- | ------ | --------------------- |
| MySQL                         | ✅        | ✅     | Via sqlx              |
| PostgreSQL                    | ✅        | ✅     | Via sqlx              |
| SQLite                        | ✅        | ✅     | Via sqlx              |
| MariaDB                       | ✅        | ❌     | Même driver MySQL     |
| Microsoft SQL Server          | ✅        | ❌     | tiberius crate        |
| Redis                         | ✅        | ❌     | redis-rs crate        |
| CockroachDB                   | ✅        | ❌     | Compatible PostgreSQL |
| Redshift                      | ✅        | ❌     | Compatible PostgreSQL |
| Vertica                       | ✅        | ❌     | ODBC driver           |
| Multi-connexions simultanées  | ✅        | ✅     | Pool manager          |
| Multi-onglets/fenêtres        | ✅        | ✅     | Tab system            |
| SSL/TLS                       | ✅        | ✅     | Config par connexion  |
| SSH Tunnel                    | ✅        | ❌     | russh crate           |
| Persistence connexions (JSON) | ✅        | ✅     | AppData config        |
| Keychain/Credential Manager   | ✅        | ❌     | tauri-plugin-keyring  |

#### 🗂️ Navigation et Exploration

| Fonctionnalité                   | TablePlus | Status | Notes           |
| -------------------------------- | --------- | ------ | --------------- |
| Liste databases                  | ✅        | ✅     |                 |
| Liste tables                     | ✅        | ✅     |                 |
| Liste vues                       | ✅        | ❌     |                 |
| Liste fonctions                  | ✅        | ❌     |                 |
| Liste colonnes/indexes           | ✅        | ❌     | Schema explorer |
| Sidebar avec tree view           | ✅        | ✅     |                 |
| Recherche rapide "Open Anything" | ✅        | ❌     | Cmd+K           |
| Preview relations/FK             | ✅        | ❌     |                 |

#### ✏️ Édition de Données

| Fonctionnalité                 | TablePlus | Status | Notes          |
| ------------------------------ | --------- | ------ | -------------- |
| Vue grille (spreadsheet)       | ✅        | ❌     | TanStack Table |
| Édition inline cellules        | ✅        | ❌     |                |
| Ajout de lignes                | ✅        | ❌     |                |
| Suppression de lignes          | ✅        | ❌     |                |
| Commit explicite (Cmd+S)       | ✅        | ❌     |                |
| Rollback/Annuler changements   | ✅        | ❌     |                |
| Aperçu SQL généré              | ✅        | ❌     | Modal preview  |
| Couleurs pour types de données | ✅        | ❌     |                |
| NULL handling visuel           | ✅        | ❌     | Badge spécial  |

#### 🖥️ Éditeur SQL

| Fonctionnalité              | TablePlus | Status | Notes         |
| --------------------------- | --------- | ------ | ------------- |
| Éditeur SQL                 | ✅        | ❌     | CodeMirror    |
| Coloration syntaxique       | ✅        | ❌     | lang-sql      |
| Auto-complétion tables      | ✅        | ❌     |               |
| Auto-complétion colonnes    | ✅        | ❌     |               |
| Auto-complétion mots-clés   | ✅        | ❌     |               |
| Exécution query (Cmd+Enter) | ✅        | ❌     |               |
| Exécution multi-statements  | ✅        | ❌     | Split par ;   |
| Résultats en onglets        | ✅        | 🔄     |               |
| Historique requêtes         | ✅        | ❌     | Stocké JSON   |
| Requêtes favorites          | ✅        | ❌     |               |
| Format/Beautify SQL         | ✅        | ❌     | sql-formatter |
| Explain query plan          | ✅        | ❌     |               |

#### 🔍 Filtrage et Recherche

| Fonctionnalité             | TablePlus | Status | Notes       |
| -------------------------- | --------- | ------ | ----------- |
| Tri colonnes (clic header) | ✅        | ❌     |             |
| Filtre égalité (=)         | ✅        | ❌     |             |
| Filtre contient (LIKE)     | ✅        | ❌     |             |
| Filtre IS NULL             | ✅        | ❌     |             |
| Filtre IN (...)            | ✅        | ❌     |             |
| Filtres combinés (AND/OR)  | ✅        | ❌     |             |
| Pagination                 | ✅        | ❌     | Server-side |
| Jump to page               | ✅        | ❌     |             |
| Rows per page config       | ✅        | ❌     |             |

#### 🏗️ Gestion de Structure

| Fonctionnalité                | TablePlus | Status | Notes          |
| ----------------------------- | --------- | ------ | -------------- |
| Voir schema table             | ✅        | ❌     |                |
| Créer table (UI)              | ✅        | ❌     |                |
| Modifier colonnes (UI)        | ✅        | ❌     |                |
| Ajouter/supprimer colonnes    | ✅        | ❌     |                |
| Créer/modifier indexes        | ✅        | ❌     |                |
| Créer/modifier contraintes FK | ✅        | ❌     |                |
| ERD / Diagramme relations     | ✅        | ❌     | D3.js ou dagre |

#### 📥 Import / Export

| Fonctionnalité          | TablePlus | Status | Notes              |
| ----------------------- | --------- | ------ | ------------------ |
| Export CSV              | ✅        | ❌     |                    |
| Export JSON             | ✅        | ❌     |                    |
| Export SQL dump         | ✅        | ❌     | pg_dump, mysqldump |
| Export Excel            | ✅        | ❌     | xlsx crate         |
| Import CSV              | ✅        | ❌     |                    |
| Import SQL              | ✅        | ❌     |                    |
| Mapping colonnes import | ✅        | ❌     |                    |

#### 🔐 Sécurité et Fiabilité

| Fonctionnalité           | TablePlus | Status | Notes        |
| ------------------------ | --------- | ------ | ------------ |
| Aperçu SQL avant apply   | ✅        | ❌     |              |
| Transactions explicites  | ✅        | ❌     |              |
| Rollback en cas d'erreur | ✅        | ❌     |              |
| Confirmation delete      | ✅        | ✅     | Dialog       |
| Read-only mode           | ✅        | ❌     |              |
| Timeout requêtes         | ✅        | ❌     | Configurable |

#### 🎨 UX et Productivité

| Fonctionnalité            | TablePlus | Status | Notes         |
| ------------------------- | --------- | ------ | ------------- |
| Interface native          | ✅        | ✅     | Tauri         |
| Dark mode                 | ✅        | ✅     |               |
| Light mode                | ✅        | ✅     |               |
| Thèmes custom             | ✅        | ❌     |               |
| Raccourcis clavier        | ✅        | ❌     |               |
| Connexions favorites      | ✅        | ✅     | Star toggle   |
| Couleurs connexions       | ✅        | 🔄     | Badge couleur |
| Context menu (clic droit) | ✅        | ✅     |               |
| Vues sauvegardées         | ✅        | ❌     |               |
| Colonnes visibles toggle  | ✅        | ❌     |               |
| Resize colonnes           | ✅        | ✅     |               |
| Copy cell/row             | ✅        | ❌     |               |

### 6.2 Résumé Progression

| Catégorie       | ✅ Fait | 🔄 En cours | ❌ À faire |
| --------------- | ------- | ----------- | ---------- |
| Connexions      | 3       | 1           | 11         |
| Navigation      | 1       | 0           | 7          |
| Édition Données | 0       | 0           | 9          |
| Éditeur SQL     | 0       | 1           | 11         |
| Filtrage        | 0       | 0           | 9          |
| Structure       | 0       | 0           | 7          |
| Import/Export   | 0       | 0           | 7          |
| Sécurité        | 1       | 0           | 5          |
| UX              | 7       | 1           | 4          |
| **TOTAL**       | **12**  | **3**       | **70**     |

### 6.3 Fonctionnalités Velocity Uniques (différenciation)

Ces features ne sont pas dans TablePlus mais pourraient être ajoutées :

| Feature                  | Description                     | Status |
| ------------------------ | ------------------------------- | ------ |
| AI SQL Assistant         | Génération de requêtes via LLM  | ❌     |
| Query explain visuel     | Visualisation graphique du plan | ❌     |
| Collaboration temps réel | Partage de queries en équipe    | ❌     |
| Plugin system            | Extensions communautaires       | ❌     |
| Schema diff              | Comparer schemas entre 2 DB     | ❌     |
| Connection URL parsing   | Coller une URL de connexion     | ✅     |

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

### 6.5 Historique et favoris

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
