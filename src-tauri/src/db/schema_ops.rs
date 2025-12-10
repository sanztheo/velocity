//! Schema DDL operations for database structure management
//!
//! Provides types and functions for CREATE TABLE, ALTER TABLE, indexes, and foreign keys.

use crate::db::pool::DatabasePool;
use crate::error::VelocityError;
use serde::{Deserialize, Serialize};

/// Column definition for table creation/modification
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDefinition {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    #[serde(default)]
    pub default_value: Option<String>,
    #[serde(default)]
    pub is_primary_key: bool,
    #[serde(default)]
    pub is_auto_increment: bool,
}

/// Index information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
    #[serde(default)]
    pub index_type: Option<String>,
}

/// Foreign key definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyDefinition {
    #[serde(default)]
    pub name: Option<String>,
    pub column: String,
    pub ref_table: String,
    pub ref_column: String,
    #[serde(default = "default_cascade")]
    pub on_delete: String,
    #[serde(default = "default_cascade")]
    pub on_update: String,
}

fn default_cascade() -> String {
    "NO ACTION".to_string()
}

/// Request to create a new table
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableRequest {
    pub name: String,
    pub columns: Vec<ColumnDefinition>,
    #[serde(default)]
    pub primary_key: Option<Vec<String>>,
}

// ============================================================================
// SQL Generation (Preview) - Returns SQL string without executing
// ============================================================================

/// Generate CREATE TABLE SQL
pub fn generate_create_table_sql(
    pool: &DatabasePool,
    request: &CreateTableRequest,
) -> Result<String, VelocityError> {
    let mut column_defs: Vec<String> = Vec::new();

    for col in &request.columns {
        let mut def = format!("\"{}\" {}", col.name, col.data_type);

        if !col.nullable {
            def.push_str(" NOT NULL");
        }

        if let Some(ref default) = col.default_value {
            def.push_str(&format!(" DEFAULT {}", default));
        }

        if col.is_auto_increment {
            match pool {
                DatabasePool::Postgres(_) => {
                    // PostgreSQL uses SERIAL or GENERATED
                    def = format!("\"{}\" SERIAL", col.name);
                    if !col.nullable {
                        def.push_str(" NOT NULL");
                    }
                }
                DatabasePool::MySQL(_) => {
                    def.push_str(" AUTO_INCREMENT");
                }
                DatabasePool::SQLite(_) => {
                    // SQLite uses INTEGER PRIMARY KEY AUTOINCREMENT
                    def = format!("\"{}\" INTEGER PRIMARY KEY AUTOINCREMENT", col.name);
                }
                _ => {}
            }
        }

        column_defs.push(def);
    }

    // Add primary key constraint if specified
    if let Some(ref pk_cols) = request.primary_key {
        if !pk_cols.is_empty() {
            let pk_str = pk_cols
                .iter()
                .map(|c| format!("\"{}\"", c))
                .collect::<Vec<_>>()
                .join(", ");
            column_defs.push(format!("PRIMARY KEY ({})", pk_str));
        }
    }

    Ok(format!(
        "CREATE TABLE \"{}\" (\n  {}\n);",
        request.name,
        column_defs.join(",\n  ")
    ))
}

/// Generate ADD COLUMN SQL
pub fn generate_add_column_sql(
    pool: &DatabasePool,
    table_name: &str,
    column: &ColumnDefinition,
) -> Result<String, VelocityError> {
    let mut def = format!("\"{}\" {}", column.name, column.data_type);

    if !column.nullable {
        def.push_str(" NOT NULL");
    }

    if let Some(ref default) = column.default_value {
        def.push_str(&format!(" DEFAULT {}", default));
    }

    match pool {
        DatabasePool::MySQL(_) => Ok(format!(
            "ALTER TABLE \"{}\" ADD COLUMN {};",
            table_name, def
        )),
        _ => Ok(format!(
            "ALTER TABLE \"{}\" ADD COLUMN {};",
            table_name, def
        )),
    }
}

/// Generate DROP COLUMN SQL
pub fn generate_drop_column_sql(
    _pool: &DatabasePool,
    table_name: &str,
    column_name: &str,
) -> Result<String, VelocityError> {
    Ok(format!(
        "ALTER TABLE \"{}\" DROP COLUMN \"{}\";",
        table_name, column_name
    ))
}

/// Generate MODIFY COLUMN SQL (rename or change type)
pub fn generate_modify_column_sql(
    pool: &DatabasePool,
    table_name: &str,
    old_name: &str,
    new_column: &ColumnDefinition,
) -> Result<String, VelocityError> {
    match pool {
        DatabasePool::Postgres(_) => {
            let mut statements = Vec::new();

            // Rename if needed
            if old_name != new_column.name {
                statements.push(format!(
                    "ALTER TABLE \"{}\" RENAME COLUMN \"{}\" TO \"{}\";",
                    table_name, old_name, new_column.name
                ));
            }

            // Change type
            statements.push(format!(
                "ALTER TABLE \"{}\" ALTER COLUMN \"{}\" TYPE {};",
                table_name, new_column.name, new_column.data_type
            ));

            // Nullability
            let null_action = if new_column.nullable {
                "DROP NOT NULL"
            } else {
                "SET NOT NULL"
            };
            statements.push(format!(
                "ALTER TABLE \"{}\" ALTER COLUMN \"{}\" {};",
                table_name, new_column.name, null_action
            ));

            Ok(statements.join("\n"))
        }
        DatabasePool::MySQL(_) => {
            let mut def = format!("\"{}\" {}", new_column.name, new_column.data_type);
            if !new_column.nullable {
                def.push_str(" NOT NULL");
            }
            if let Some(ref default) = new_column.default_value {
                def.push_str(&format!(" DEFAULT {}", default));
            }
            Ok(format!(
                "ALTER TABLE \"{}\" CHANGE COLUMN \"{}\" {};",
                table_name, old_name, def
            ))
        }
        DatabasePool::SQLite(_) => {
            // SQLite doesn't support ALTER COLUMN directly
            Err(VelocityError::Query(
                "SQLite does not support modifying columns. Recreate the table.".to_string(),
            ))
        }
        _ => Err(VelocityError::Query(
            "Unsupported database type".to_string(),
        )),
    }
}

/// Generate CREATE INDEX SQL
pub fn generate_create_index_sql(
    _pool: &DatabasePool,
    table_name: &str,
    index: &IndexInfo,
) -> Result<String, VelocityError> {
    let unique = if index.unique { "UNIQUE " } else { "" };
    let columns = index
        .columns
        .iter()
        .map(|c| format!("\"{}\"", c))
        .collect::<Vec<_>>()
        .join(", ");

    Ok(format!(
        "CREATE {}INDEX \"{}\" ON \"{}\" ({});",
        unique, index.name, table_name, columns
    ))
}

/// Generate DROP INDEX SQL
pub fn generate_drop_index_sql(
    pool: &DatabasePool,
    table_name: &str,
    index_name: &str,
) -> Result<String, VelocityError> {
    match pool {
        DatabasePool::MySQL(_) => Ok(format!(
            "DROP INDEX \"{}\" ON \"{}\";",
            index_name, table_name
        )),
        _ => Ok(format!("DROP INDEX \"{}\";", index_name)),
    }
}

/// Generate ADD FOREIGN KEY SQL
pub fn generate_add_foreign_key_sql(
    _pool: &DatabasePool,
    table_name: &str,
    fk: &ForeignKeyDefinition,
) -> Result<String, VelocityError> {
    let constraint_name = fk
        .name
        .clone()
        .unwrap_or_else(|| format!("fk_{}_{}", table_name, fk.column));

    Ok(format!(
        "ALTER TABLE \"{}\" ADD CONSTRAINT \"{}\" FOREIGN KEY (\"{}\") REFERENCES \"{}\"(\"{}\") ON DELETE {} ON UPDATE {};",
        table_name, constraint_name, fk.column, fk.ref_table, fk.ref_column, fk.on_delete, fk.on_update
    ))
}

/// Generate DROP CONSTRAINT SQL
pub fn generate_drop_constraint_sql(
    pool: &DatabasePool,
    table_name: &str,
    constraint_name: &str,
) -> Result<String, VelocityError> {
    match pool {
        DatabasePool::MySQL(_) => Ok(format!(
            "ALTER TABLE \"{}\" DROP FOREIGN KEY \"{}\";",
            table_name, constraint_name
        )),
        _ => Ok(format!(
            "ALTER TABLE \"{}\" DROP CONSTRAINT \"{}\";",
            table_name, constraint_name
        )),
    }
}

// ============================================================================
// Execution functions
// ============================================================================

/// Execute a DDL statement
pub async fn execute_ddl(pool: &DatabasePool, sql: &str) -> Result<(), VelocityError> {
    match pool {
        DatabasePool::Postgres(p) => {
            sqlx::query(sql)
                .execute(p)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
        }
        DatabasePool::MySQL(p) => {
            sqlx::query(sql)
                .execute(p)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
        }
        DatabasePool::SQLite(p) => {
            sqlx::query(sql)
                .execute(p)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
        }
        _ => {
            return Err(VelocityError::Query(
                "Unsupported database type".to_string(),
            ))
        }
    }
    Ok(())
}

/// Get indexes for a table
pub async fn get_table_indexes(
    pool: &DatabasePool,
    table_name: &str,
) -> Result<Vec<IndexInfo>, VelocityError> {
    match pool {
        DatabasePool::Postgres(p) => {
            let rows: Vec<(String, String, bool)> = sqlx::query_as(
                r#"SELECT indexname, array_to_string(array_agg(a.attname), ',') as columns, indisunique
                   FROM pg_indexes 
                   JOIN pg_class c ON c.relname = indexname
                   JOIN pg_index i ON i.indexrelid = c.oid
                   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                   WHERE tablename = $1 AND schemaname = 'public'
                   GROUP BY indexname, indisunique"#
            )
            .bind(table_name)
            .fetch_all(p)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(|(name, cols, unique)| IndexInfo {
                    name,
                    columns: cols.split(',').map(|s| s.to_string()).collect(),
                    unique,
                    index_type: None,
                })
                .collect())
        }
        DatabasePool::MySQL(p) => {
            let rows: Vec<(String, String, i32)> = sqlx::query_as(
                "SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_NAME = ? ORDER BY SEQ_IN_INDEX"
            )
            .bind(table_name)
            .fetch_all(p)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

            // Group by index name
            let mut indexes: std::collections::HashMap<String, IndexInfo> =
                std::collections::HashMap::new();
            for (name, col, non_unique) in rows {
                indexes
                    .entry(name.clone())
                    .or_insert_with(|| IndexInfo {
                        name,
                        columns: Vec::new(),
                        unique: non_unique == 0,
                        index_type: None,
                    })
                    .columns
                    .push(col);
            }
            Ok(indexes.into_values().collect())
        }
        DatabasePool::SQLite(p) => {
            let rows: Vec<(String,)> = sqlx::query_as(
                "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?",
            )
            .bind(table_name)
            .fetch_all(p)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(|(name,)| IndexInfo {
                    name,
                    columns: Vec::new(), // SQLite requires PRAGMA to get columns
                    unique: false,
                    index_type: None,
                })
                .collect())
        }
        _ => Ok(vec![]),
    }
}
