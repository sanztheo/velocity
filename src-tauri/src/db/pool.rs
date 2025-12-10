use crate::error::VelocityError;
use crate::models::connection::{Connection, ConnectionConfig};
use sqlx::{Column, ConnectOptions, MySql, Pool, Postgres, Row, Sqlite};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Enum to hold different database pool types
pub enum DatabasePool {
    Postgres(Pool<Postgres>),
    MySQL(Pool<MySql>),
    SQLite(Pool<Sqlite>),
    // SQL Server uses a different connection type - config for lazy connect
    SQLServer(SqlServerPool),
    // Redis client
    Redis(RedisPool),
}

/// SQL Server connection wrapper
pub struct SqlServerPool {
    pub config: tiberius::Config,
}

/// Redis connection wrapper  
pub struct RedisPool {
    pub client: redis::Client,
}

/// Global connection pool manager
pub struct ConnectionPoolManager {
    pools: RwLock<HashMap<String, Arc<DatabasePool>>>,
}

impl ConnectionPoolManager {
    pub fn new() -> Self {
        Self {
            pools: RwLock::new(HashMap::new()),
        }
    }

    /// Test a connection without storing it
    pub async fn test_connection(connection: &Connection) -> Result<(), VelocityError> {
        crate::db::factory::DatabaseFactory::test_connection(connection).await
    }

    /// Connect and store the pool
    pub async fn connect(&self, connection: &Connection) -> Result<(), VelocityError> {
        let pool = crate::db::factory::DatabaseFactory::create_pool(connection).await?;

        let mut pools = self.pools.write().await;
        pools.insert(connection.id.clone(), Arc::new(pool));
        Ok(())
    }

    /// Disconnect and remove the pool
    pub async fn disconnect(&self, connection_id: &str) -> Result<(), VelocityError> {
        let mut pools = self.pools.write().await;
        if let Some(pool) = pools.remove(connection_id) {
            if let Ok(p) = Arc::try_unwrap(pool) {
                match p {
                    DatabasePool::Postgres(pool) => pool.close().await,
                    DatabasePool::MySQL(pool) => pool.close().await,
                    DatabasePool::SQLite(pool) => pool.close().await,
                    DatabasePool::SQLServer(_) => {}
                    DatabasePool::Redis(_) => {}
                }
            }
        }
        Ok(())
    }

    pub async fn is_connected(&self, connection_id: &str) -> bool {
        self.pools.read().await.contains_key(connection_id)
    }

    pub async fn get_pool(&self, connection_id: &str) -> Option<Arc<DatabasePool>> {
        self.pools.read().await.get(connection_id).cloned()
    }

    pub async fn list_databases(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
                )
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::MySQL(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as("SHOW DATABASES")
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::SQLite(_) => Ok(vec!["main".to_string()]),
            DatabasePool::SQLServer(_) => Ok(vec!["master".to_string()]),
            DatabasePool::Redis(_) => Ok((0..16).map(|i| format!("db{}", i)).collect()),
        }
    }

    pub async fn list_tables(
        &self,
        connection_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let mut query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename".to_string();
                if let Some(l) = limit {
                    query.push_str(&format!(" LIMIT {}", l));
                }
                if let Some(o) = offset {
                    query.push_str(&format!(" OFFSET {}", o));
                }

                let rows: Vec<(String,)> = sqlx::query_as(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::MySQL(pool) => {
                // Using information_schema for consistent pagination support
                let mut query = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME".to_string();
                if let Some(l) = limit {
                    query.push_str(&format!(" LIMIT {}", l));
                }
                if let Some(o) = offset {
                    query.push_str(&format!(" OFFSET {}", o));
                }

                let rows: Vec<(String,)> = sqlx::query_as(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::SQLite(pool) => {
                let mut query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name".to_string();
                if let Some(l) = limit {
                    query.push_str(&format!(" LIMIT {}", l));
                }
                if let Some(o) = offset {
                    query.push_str(&format!(" OFFSET {}", o));
                }

                let rows: Vec<(String,)> = sqlx::query_as(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::SQLServer(_) => Ok(vec![]),
            DatabasePool::Redis(redis_pool) => {
                let mut conn = redis_pool
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                // Redis doesn't support OFFSET/LIMIT on KEYS gracefully without SCAN or sorting entire list.
                // For now, we fetch all keys and slice in memory if needed, but this is heavy.
                // A Better approach is to use SCAN if limit is small, but SCAN returns random keys.
                // Given the requirement is listing tables for a UI, getting all keys is the standard "bad" way.
                // We'll stick to fetching keys and slicing for consistency with the interface, even if inefficient for Redis.
                let mut keys: Vec<String> = redis::cmd("KEYS")
                    .arg("*")
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                keys.sort();

                let start = offset.unwrap_or(0) as usize;
                let end = if let Some(l) = limit {
                    std::cmp::min(start + l as usize, keys.len())
                } else {
                    keys.len()
                };

                if start >= keys.len() {
                    Ok(vec![])
                } else {
                    Ok(keys[start..end].to_vec())
                }
            }
        }
    }

    /// List views for a connection (efficient - uses system catalogs)
    pub async fn list_views(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname",
                )
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::MySQL(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
                ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::SQLite(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name",
                )
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            _ => Ok(vec![]),
        }
    }

    /// List functions for a connection (efficient - uses system catalogs)
    pub async fn list_functions(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name"
                ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::MySQL(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() ORDER BY ROUTINE_NAME"
                ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            _ => Ok(vec![]),
        }
    }

    /// Get foreign key relationships for a table
    pub async fn get_table_foreign_keys(
        &self,
        connection_id: &str,
        table_name: &str,
    ) -> Result<Vec<crate::commands::database::ForeignKeyInfo>, VelocityError> {
        use crate::commands::database::ForeignKeyInfo;

        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String, String, String, String)> = sqlx::query_as(
                    r#"SELECT 
                        tc.constraint_name,
                        kcu.column_name,
                        ccu.table_name AS referenced_table,
                        ccu.column_name AS referenced_column
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                        AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                        AND tc.table_name = $1
                        AND tc.table_schema = 'public'
                    ORDER BY tc.constraint_name"#,
                )
                .bind(table_name)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

                Ok(rows
                    .into_iter()
                    .map(
                        |(constraint_name, column_name, referenced_table, referenced_column)| {
                            ForeignKeyInfo {
                                constraint_name,
                                column_name,
                                referenced_table,
                                referenced_column,
                            }
                        },
                    )
                    .collect())
            }
            DatabasePool::MySQL(pool) => {
                let rows: Vec<(String, String, String, String)> = sqlx::query_as(
                    r#"SELECT 
                        CONSTRAINT_NAME,
                        COLUMN_NAME,
                        REFERENCED_TABLE_NAME,
                        REFERENCED_COLUMN_NAME
                    FROM information_schema.KEY_COLUMN_USAGE
                    WHERE TABLE_NAME = ?
                        AND REFERENCED_TABLE_NAME IS NOT NULL
                        AND TABLE_SCHEMA = DATABASE()
                    ORDER BY CONSTRAINT_NAME"#,
                )
                .bind(table_name)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

                Ok(rows
                    .into_iter()
                    .map(
                        |(constraint_name, column_name, referenced_table, referenced_column)| {
                            ForeignKeyInfo {
                                constraint_name,
                                column_name,
                                referenced_table,
                                referenced_column,
                            }
                        },
                    )
                    .collect())
            }
            DatabasePool::SQLite(pool) => {
                // SQLite uses PRAGMA for FK info
                let rows: Vec<(i32, i32, String, String, String, String, String, String)> =
                    sqlx::query_as(&format!("PRAGMA foreign_key_list('{}')", table_name))
                        .fetch_all(pool)
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;

                Ok(rows
                    .into_iter()
                    .map(|(id, _, table, from, to, _, _, _)| ForeignKeyInfo {
                        constraint_name: format!("fk_{}", id),
                        column_name: from,
                        referenced_table: table,
                        referenced_column: to,
                    })
                    .collect())
            }
            _ => Ok(vec![]),
        }
    }

    pub async fn get_table_schema(
        &self,
        connection_id: &str,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String, String, String, Option<i32>)> = sqlx::query_as(
                    r#"SELECT column_name, data_type, CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END, character_maximum_length
                    FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position"#
                ).bind(table_name).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;

                Ok(rows
                    .into_iter()
                    .map(|(name, data_type, nullable, max_length)| ColumnInfo {
                        name,
                        data_type,
                        nullable: nullable == "YES",
                        max_length,
                        is_primary_key: false,
                    })
                    .collect())
            }
            DatabasePool::MySQL(pool) => {
                let rows: Vec<(String, String, String, Option<i64>)> = sqlx::query_as(
                    r#"SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                    FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION"#
                ).bind(table_name).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;

                Ok(rows
                    .into_iter()
                    .map(|(name, data_type, nullable, max_length)| ColumnInfo {
                        name,
                        data_type,
                        nullable: nullable == "YES",
                        max_length: max_length.map(|l| l as i32),
                        is_primary_key: false,
                    })
                    .collect())
            }
            DatabasePool::SQLite(pool) => {
                let rows: Vec<(i32, String, String, i32, Option<String>, i32)> =
                    sqlx::query_as(&format!("PRAGMA table_info({})", table_name))
                        .fetch_all(pool)
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;

                Ok(rows
                    .into_iter()
                    .map(|(_, name, data_type, notnull, _, pk)| ColumnInfo {
                        name,
                        data_type,
                        nullable: notnull == 0,
                        max_length: None,
                        is_primary_key: pk == 1,
                    })
                    .collect())
            }
            DatabasePool::SQLServer(_) => Ok(vec![]),
            DatabasePool::Redis(_) => Ok(vec![ColumnInfo {
                name: "value".into(),
                data_type: "string".into(),
                nullable: true,
                max_length: None,
                is_primary_key: false,
            }]),
        }
    }

    pub async fn get_table_data(
        &self,
        connection_id: &str,
        table_name: &str,
        limit: i32,
        offset: i32,
    ) -> Result<TableData, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        let columns = self.get_table_schema(connection_id, table_name).await?;
        let column_names: Vec<String> = columns.iter().map(|c| c.name.clone()).collect();
        let query = format!(
            "SELECT * FROM {} LIMIT {} OFFSET {}",
            table_name, limit, offset
        );

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows = sqlx::query(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                let data = rows
                    .iter()
                    .map(|row| {
                        use sqlx::Row;
                        column_names
                            .iter()
                            .enumerate()
                            .map(|(i, _)| {
                                row.try_get::<String, _>(i)
                                    .map(serde_json::Value::String)
                                    .or_else(|_| {
                                        row.try_get::<i64, _>(i)
                                            .map(|v| serde_json::Value::Number(v.into()))
                                    })
                                    .or_else(|_| {
                                        row.try_get::<i32, _>(i)
                                            .map(|v| serde_json::Value::Number(v.into()))
                                    })
                                    .or_else(|_| {
                                        row.try_get::<bool, _>(i).map(serde_json::Value::Bool)
                                    })
                                    .unwrap_or(serde_json::Value::Null)
                            })
                            .collect()
                    })
                    .collect();
                Ok(TableData {
                    columns: column_names,
                    rows: data,
                })
            }
            DatabasePool::MySQL(pool) => {
                let rows = sqlx::query(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                let data = rows
                    .iter()
                    .map(|row| {
                        use sqlx::Row;
                        column_names
                            .iter()
                            .enumerate()
                            .map(|(i, _)| {
                                row.try_get::<String, _>(i)
                                    .map(serde_json::Value::String)
                                    .or_else(|_| {
                                        row.try_get::<i64, _>(i)
                                            .map(|v| serde_json::Value::Number(v.into()))
                                    })
                                    .or_else(|_| {
                                        row.try_get::<bool, _>(i).map(serde_json::Value::Bool)
                                    })
                                    .unwrap_or(serde_json::Value::Null)
                            })
                            .collect()
                    })
                    .collect();
                Ok(TableData {
                    columns: column_names,
                    rows: data,
                })
            }
            DatabasePool::SQLite(pool) => {
                let rows = sqlx::query(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                let data = rows
                    .iter()
                    .map(|row| {
                        use sqlx::Row;
                        column_names
                            .iter()
                            .enumerate()
                            .map(|(i, _)| {
                                row.try_get::<String, _>(i)
                                    .map(serde_json::Value::String)
                                    .or_else(|_| {
                                        row.try_get::<i64, _>(i)
                                            .map(|v| serde_json::Value::Number(v.into()))
                                    })
                                    .or_else(|_| {
                                        row.try_get::<bool, _>(i).map(serde_json::Value::Bool)
                                    })
                                    .unwrap_or(serde_json::Value::Null)
                            })
                            .collect()
                    })
                    .collect();
                Ok(TableData {
                    columns: column_names,
                    rows: data,
                })
            }
            DatabasePool::SQLServer(_) => Ok(TableData {
                columns: vec![],
                rows: vec![],
            }),
            DatabasePool::Redis(redis_pool) => {
                let mut conn = redis_pool
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                let value: Option<String> = redis::cmd("GET")
                    .arg(table_name)
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                let rows = value
                    .map(|v| vec![vec![serde_json::Value::String(v)]])
                    .unwrap_or_default();
                Ok(TableData {
                    columns: vec!["value".into()],
                    rows,
                })
            }
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub max_length: Option<i32>,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TableData {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
}

impl Default for ConnectionPoolManager {
    fn default() -> Self {
        Self::new()
    }
}

use crate::commands::database::{ExecuteResult, PendingChange};

impl ConnectionPoolManager {
    /// Execute pending changes (INSERT, UPDATE, DELETE) in a transaction
    pub async fn execute_changes(
        &self,
        connection_id: &str,
        table_name: &str,
        primary_key_column: &str,
        changes: Vec<PendingChange>,
    ) -> Result<ExecuteResult, VelocityError> {
        let pools = self.pools.read().await;
        let pool = pools.get(connection_id).ok_or_else(|| {
            VelocityError::NotFound(format!("Connection {} not found", connection_id))
        })?;

        let mut rows_affected: i64 = 0;
        let mut errors: Vec<String> = Vec::new();

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                // Start transaction
                let mut tx = pool
                    .begin()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                for change in changes {
                    let result = match change.change_type.as_str() {
                        "update" => {
                            // Use raw SQL with properly formatted value to preserve types
                            let formatted_value = format_value_for_sql(&change.new_value);
                            let sql = format!(
                                "UPDATE \"{}\" SET \"{}\" = {} WHERE \"{}\" = {}",
                                table_name,
                                change.column,
                                formatted_value,
                                primary_key_column,
                                format_pk_for_sql(&change.row_id)
                            );
                            sqlx::query(&sql).execute(&mut *tx).await
                        }
                        "delete" => {
                            let sql = format!(
                                "DELETE FROM \"{}\" WHERE \"{}\" = {}",
                                table_name,
                                primary_key_column,
                                format_pk_for_sql(&change.row_id)
                            );
                            sqlx::query(&sql).execute(&mut *tx).await
                        }
                        "insert" => {
                            let formatted_value = format_value_for_sql(&change.new_value);
                            let sql = format!(
                                "INSERT INTO \"{}\" (\"{}\") VALUES ({})",
                                table_name, change.column, formatted_value
                            );
                            sqlx::query(&sql).execute(&mut *tx).await
                        }
                        _ => continue,
                    };

                    match result {
                        Ok(r) => rows_affected += r.rows_affected() as i64,
                        Err(e) => errors.push(format!("{}: {}", change.change_type, e)),
                    }
                }

                if errors.is_empty() {
                    tx.commit()
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;
                } else {
                    tx.rollback()
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;
                }
            }
            DatabasePool::MySQL(pool) => {
                let mut tx = pool
                    .begin()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                for change in changes {
                    let result = match change.change_type.as_str() {
                        "update" => {
                            let formatted_value = format_value_for_sql(&change.new_value);
                            let sql = format!(
                                "UPDATE `{}` SET `{}` = {} WHERE `{}` = {}",
                                table_name,
                                change.column,
                                formatted_value,
                                primary_key_column,
                                format_pk_for_sql(&change.row_id)
                            );
                            sqlx::query(&sql).execute(&mut *tx).await
                        }
                        "delete" => {
                            let sql = format!(
                                "DELETE FROM `{}` WHERE `{}` = {}",
                                table_name,
                                primary_key_column,
                                format_pk_for_sql(&change.row_id)
                            );
                            sqlx::query(&sql).execute(&mut *tx).await
                        }
                        _ => continue,
                    };

                    match result {
                        Ok(r) => rows_affected += r.rows_affected() as i64,
                        Err(e) => errors.push(format!("{}: {}", change.change_type, e)),
                    }
                }

                if errors.is_empty() {
                    tx.commit()
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;
                } else {
                    tx.rollback()
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;
                }
            }
            DatabasePool::SQLite(pool) => {
                let mut tx = pool
                    .begin()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                for change in changes {
                    let result = match change.change_type.as_str() {
                        "update" => {
                            let formatted_value = format_value_for_sql(&change.new_value);
                            let sql = format!(
                                "UPDATE \"{}\" SET \"{}\" = {} WHERE \"{}\" = {}",
                                table_name,
                                change.column,
                                formatted_value,
                                primary_key_column,
                                format_pk_for_sql(&change.row_id)
                            );
                            sqlx::query(&sql).execute(&mut *tx).await
                        }
                        "delete" => {
                            let sql = format!(
                                "DELETE FROM \"{}\" WHERE \"{}\" = {}",
                                table_name,
                                primary_key_column,
                                format_pk_for_sql(&change.row_id)
                            );
                            sqlx::query(&sql).execute(&mut *tx).await
                        }
                        _ => continue,
                    };

                    match result {
                        Ok(r) => rows_affected += r.rows_affected() as i64,
                        Err(e) => errors.push(format!("{}: {}", change.change_type, e)),
                    }
                }

                if errors.is_empty() {
                    tx.commit()
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;
                } else {
                    tx.rollback()
                        .await
                        .map_err(|e| VelocityError::Query(e.to_string()))?;
                }
            }
            _ => {
                return Err(VelocityError::Query(
                    "Execute changes not supported for this database type".to_string(),
                ));
            }
        }

        Ok(ExecuteResult {
            success: errors.is_empty(),
            rows_affected,
            errors,
        })
    }
}

/// Format a JSON value for use directly in SQL (preserves type)
fn format_value_for_sql(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => {
            // Escape single quotes for SQL
            let escaped = s.replace('\'', "''");
            format!("'{}'", escaped)
        }
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            // JSON types - escape and quote
            let json_str = value.to_string().replace('\'', "''");
            format!("'{}'", json_str)
        }
    }
}

/// Format a primary key value for use in SQL WHERE clause
fn format_pk_for_sql(pk: &str) -> String {
    // Try to parse as number first
    if pk.parse::<i64>().is_ok() || pk.parse::<f64>().is_ok() {
        pk.to_string()
    } else {
        // It's a string (like UUID) - escape and quote
        let escaped = pk.replace('\'', "''");
        format!("'{}'", escaped)
    }
}

/// Helper to convert JSON value to string for binding (used by MySQL/SQLite)
#[allow(dead_code)]
fn json_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => Some(value.to_string()),
    }
}
