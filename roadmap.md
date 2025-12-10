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
| MariaDB                       | ✅        | ✅     | Même driver MySQL     |
| Microsoft SQL Server          | ✅        | ✅     | Via tiberius          |
| Redis                         | ✅        | ✅     | Via redis-rs          |
| CockroachDB                   | ✅        | ✅     | Compatible PostgreSQL |
| Redshift                      | ✅        | ✅     | Compatible PostgreSQL |
| Vertica                       | ✅        | ❌     | ODBC driver           |
| Multi-connexions simultanées  | ✅        | ✅     | Pool manager          |
| Multi-onglets/fenêtres        | ✅        | ✅     | Tab system            |
| SSL/TLS                       | ✅        | ✅     | Config par connexion  |
| SSH Tunnel                    | ✅        | ✅     | russh crate           |
| Persistence connexions (JSON) | ✅        | ✅     | AppData config        |
| Keychain/Credential Manager   | ✅        | ✅     | tauri-plugin-keyring  |

#### 🗂️ Navigation et Exploration

| Fonctionnalité                   | TablePlus | Status | Notes            |
| -------------------------------- | --------- | ------ | ---------------- |
| Fonctionnalité                   | TablePlus | Status | Notes            |
| -------------------------------- | --------- | ------ | ---------------- |
| Liste databases                  | ✅        | ✅     |                  |
| Liste tables                     | ✅        | ✅     |                  |
| Liste vues                       | ✅        | ✅     | pg_views query   |
| Liste fonctions                  | ✅        | ✅     | routines query   |
| Liste colonnes/indexes           | ✅        | ✅     | Schema explorer  |
| Sidebar avec tree view           | ✅        | ✅     | Tables/Views/Fn  |
| Recherche rapide "Open Anything" | ✅        | ✅     | ⌘K / Ctrl+K      |
| Preview relations/FK             | ✅        | ✅     | ForeignKeysPanel |

#### ✏️ Édition de Données

| Fonctionnalité                 | TablePlus | Status | Notes               |
| ------------------------------ | --------- | ------ | ------------------- |
| Vue grille (spreadsheet)       | ✅        | ✅     | TanStack Virtual    |
| Édition inline cellules        | ✅        | ✅     | Double-click        |
| Ajout de lignes                | ✅        | ✅     | Bouton + Row        |
| Suppression de lignes          | ✅        | ✅     | Delete icon         |
| Commit explicite (Cmd+S)       | ✅        | ✅     | Modal + transaction |
| Rollback/Annuler changements   | ✅        | ✅     | Escape / Discard    |
| Aperçu SQL généré              | ✅        | ✅     | SqlPreviewModal     |
| Couleurs pour types de données | ✅        | ✅     | EditableCell        |
| NULL handling visuel           | ✅        | ✅     | Italic + muted      |

#### 🖥️ Éditeur SQL

| Fonctionnalité              | TablePlus | Status | Notes            |
| --------------------------- | --------- | ------ | ---------------- |
| Éditeur SQL                 | ✅        | ✅     | CodeMirror       |
| Coloration syntaxique       | ✅        | ✅     | lang-sql         |
| Auto-complétion tables      | ✅        | ✅     | Custom completer |
| Auto-complétion colonnes    | ✅        | ✅     | Custom completer |
| Auto-complétion mots-clés   | ✅        | ✅     | PostgreSQL/MySQL |
| Exécution query (Cmd+Enter) | ✅        | ✅     | ⌘↵ shortcut      |
| Exécution multi-statements  | ✅        | ✅     | Split par ;      |
| Résultats en onglets        | ✅        | ✅     | Tabs component   |
| Historique requêtes         | ✅        | ✅     | localStorage     |
| Requêtes favorites          | ✅        | ✅     | Star toggle      |
| Format/Beautify SQL         | ✅        | ✅     | sql-formatter    |
| Explain query plan          | ✅        | ✅     | EXPLAIN ANALYZE  |

#### 🔍 Filtrage et Recherche

| Fonctionnalité             | TablePlus | Status | Notes                 |
| -------------------------- | --------- | ------ | --------------------- |
| Tri colonnes (clic header) | ✅        | ✅     | SortableHeader        |
| Filtre égalité (=)         | ✅        | ✅     | FilterBar             |
| Filtre contient (LIKE)     | ✅        | ✅     | ILIKE search          |
| Filtre IS NULL             | ✅        | ✅     | IS NULL / IS NOT NULL |
| Filtre IN (...)            | ✅        | ✅     | Comma-separated       |
| Filtres combinés (AND/OR)  | ✅        | ✅     | Toggle AND/OR         |
| Pagination                 | ✅        | ✅     | Server-side           |
| Jump to page               | ✅        | ✅     | Input numérique       |
| Rows per page config       | ✅        | ✅     | 25/50/100/250/500     |

#### 🏗️ Gestion de Structure

| Fonctionnalité                | TablePlus | Status | Notes          |
| ----------------------------- | --------- | ------ | -------------- |
| Voir schema table             | ✅        | ✅     |                |
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
| Connexions      | 14      | 0           | 1          |
| Navigation      | 8       | 0           | 0          |
| Édition Données | 9       | 0           | 0          |
| Éditeur SQL     | 12      | 0           | 0          |
| Filtrage        | 1       | 0           | 8          |
| Structure       | 1       | 0           | 6          |
| Import/Export   | 0       | 0           | 7          |
| Sécurité        | 1       | 0           | 5          |
| UX              | 8       | 1           | 3          |
| **TOTAL**       | **54**  | **1**       | **30**     |

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
