use crate::error::VelocityError;
use crate::models::connection::{Connection, ConnectionConfig};
use sqlx::{MySql, Pool, Postgres, Sqlite};
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
        match &connection.config {
            ConnectionConfig::PostgreSQL {
                host,
                port,
                database,
                username,
                password,
                ..
            }
            | ConnectionConfig::CockroachDB {
                host,
                port,
                database,
                username,
                password,
                ..
            }
            | ConnectionConfig::Redshift {
                host,
                port,
                database,
                username,
                password,
                ..
            } => {
                let url = format!(
                    "postgres://{}:{}@{}:{}/{}",
                    username,
                    password.as_deref().unwrap_or(""),
                    host,
                    port,
                    database
                );

                let pool = sqlx::postgres::PgPoolOptions::new()
                    .max_connections(1)
                    .acquire_timeout(std::time::Duration::from_secs(5))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                sqlx::query("SELECT 1")
                    .execute(&pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                pool.close().await;
                Ok(())
            }
            ConnectionConfig::MySQL {
                host,
                port,
                database,
                username,
                password,
                ..
            }
            | ConnectionConfig::MariaDB {
                host,
                port,
                database,
                username,
                password,
                ..
            } => {
                let url = format!(
                    "mysql://{}:{}@{}:{}/{}",
                    username,
                    password.as_deref().unwrap_or(""),
                    host,
                    port,
                    database
                );

                let pool = sqlx::mysql::MySqlPoolOptions::new()
                    .max_connections(1)
                    .acquire_timeout(std::time::Duration::from_secs(5))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                sqlx::query("SELECT 1")
                    .execute(&pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                pool.close().await;
                Ok(())
            }
            ConnectionConfig::SQLite { path } => {
                let url = format!("sqlite:{}", path.display());

                let pool = sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(1)
                    .acquire_timeout(std::time::Duration::from_secs(5))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                sqlx::query("SELECT 1")
                    .execute(&pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                pool.close().await;
                Ok(())
            }
            ConnectionConfig::SQLServer {
                host,
                port,
                database,
                username,
                password,
                encrypt,
                trust_server_certificate,
            } => {
                use tokio::net::TcpStream;
                use tokio_util::compat::TokioAsyncWriteCompatExt;

                let mut config = tiberius::Config::new();
                config.host(host);
                config.port(*port);
                config.database(database);
                config.authentication(tiberius::AuthMethod::sql_server(
                    username,
                    password.as_deref().unwrap_or(""),
                ));

                if *encrypt {
                    config.encryption(tiberius::EncryptionLevel::Required);
                } else {
                    config.encryption(tiberius::EncryptionLevel::NotSupported);
                }

                if *trust_server_certificate {
                    config.trust_cert();
                }

                let tcp = TcpStream::connect(format!("{}:{}", host, port))
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                tcp.set_nodelay(true)
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                let mut client = tiberius::Client::connect(config, tcp.compat_write())
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                client
                    .simple_query("SELECT 1")
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

                Ok(())
            }
            ConnectionConfig::Redis {
                host,
                port,
                password,
                database,
                use_tls,
            } => {
                use redis::AsyncCommands;

                let url = match (password, use_tls) {
                    (Some(pwd), true) => {
                        format!("rediss://:{}@{}:{}/{}", pwd, host, port, database)
                    }
                    (Some(pwd), false) => {
                        format!("redis://:{}@{}:{}/{}", pwd, host, port, database)
                    }
                    (None, true) => format!("rediss://{}:{}/{}", host, port, database),
                    (None, false) => format!("redis://{}:{}/{}", host, port, database),
                };

                let client = redis::Client::open(url)
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                let mut conn = client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                let _: String = redis::cmd("PING")
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                Ok(())
            }
        }
    }

    /// Connect and store the pool
    pub async fn connect(&self, connection: &Connection) -> Result<(), VelocityError> {
        let pool = match &connection.config {
            ConnectionConfig::PostgreSQL {
                host,
                port,
                database,
                username,
                password,
                ..
            }
            | ConnectionConfig::CockroachDB {
                host,
                port,
                database,
                username,
                password,
                ..
            }
            | ConnectionConfig::Redshift {
                host,
                port,
                database,
                username,
                password,
                ..
            } => {
                let url = format!(
                    "postgres://{}:{}@{}:{}/{}",
                    username,
                    password.as_deref().unwrap_or(""),
                    host,
                    port,
                    database
                );

                let pool = sqlx::postgres::PgPoolOptions::new()
                    .max_connections(5)
                    .acquire_timeout(std::time::Duration::from_secs(10))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                DatabasePool::Postgres(pool)
            }
            ConnectionConfig::MySQL {
                host,
                port,
                database,
                username,
                password,
                ..
            }
            | ConnectionConfig::MariaDB {
                host,
                port,
                database,
                username,
                password,
                ..
            } => {
                let url = format!(
                    "mysql://{}:{}@{}:{}/{}",
                    username,
                    password.as_deref().unwrap_or(""),
                    host,
                    port,
                    database
                );

                let pool = sqlx::mysql::MySqlPoolOptions::new()
                    .max_connections(5)
                    .acquire_timeout(std::time::Duration::from_secs(10))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                DatabasePool::MySQL(pool)
            }
            ConnectionConfig::SQLite { path } => {
                let url = format!("sqlite:{}", path.display());

                let pool = sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(5)
                    .acquire_timeout(std::time::Duration::from_secs(10))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                DatabasePool::SQLite(pool)
            }
            ConnectionConfig::SQLServer {
                host,
                port,
                database,
                username,
                password,
                encrypt,
                trust_server_certificate,
            } => {
                let mut config = tiberius::Config::new();
                config.host(host);
                config.port(*port);
                config.database(database);
                config.authentication(tiberius::AuthMethod::sql_server(
                    username,
                    password.as_deref().unwrap_or(""),
                ));

                if *encrypt {
                    config.encryption(tiberius::EncryptionLevel::Required);
                } else {
                    config.encryption(tiberius::EncryptionLevel::NotSupported);
                }

                if *trust_server_certificate {
                    config.trust_cert();
                }

                DatabasePool::SQLServer(SqlServerPool { config })
            }
            ConnectionConfig::Redis {
                host,
                port,
                password,
                database,
                use_tls,
            } => {
                let url = match (password, use_tls) {
                    (Some(pwd), true) => {
                        format!("rediss://:{}@{}:{}/{}", pwd, host, port, database)
                    }
                    (Some(pwd), false) => {
                        format!("redis://:{}@{}:{}/{}", pwd, host, port, database)
                    }
                    (None, true) => format!("rediss://{}:{}/{}", host, port, database),
                    (None, false) => format!("redis://{}:{}/{}", host, port, database),
                };

                let client = redis::Client::open(url)
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                DatabasePool::Redis(RedisPool { client })
            }
        };

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

    pub async fn list_tables(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
                ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::MySQL(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as("SHOW TABLES")
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::SQLite(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::SQLServer(_) => Ok(vec![]),
            DatabasePool::Redis(redis_pool) => {
                let mut conn = redis_pool
                    .client
                    .get_multiplexed_async_connection()
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                let keys: Vec<String> = redis::cmd("KEYS")
                    .arg("*")
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(keys)
            }
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
                            let sql = format!(
                                "UPDATE \"{}\" SET \"{}\" = $1 WHERE \"{}\" = $2",
                                table_name, change.column, primary_key_column
                            );
                            sqlx::query(&sql)
                                .bind(json_to_string(&change.new_value))
                                .bind(&change.row_id)
                                .execute(&mut *tx)
                                .await
                        }
                        "delete" => {
                            let sql = format!(
                                "DELETE FROM \"{}\" WHERE \"{}\" = $1",
                                table_name, primary_key_column
                            );
                            sqlx::query(&sql)
                                .bind(&change.row_id)
                                .execute(&mut *tx)
                                .await
                        }
                        "insert" => {
                            // For inserts, column contains all columns as JSON
                            // This is a simplified version - real impl would parse values properly
                            let sql = format!(
                                "INSERT INTO \"{}\" (\"{}\") VALUES ($1)",
                                table_name, change.column
                            );
                            sqlx::query(&sql)
                                .bind(json_to_string(&change.new_value))
                                .execute(&mut *tx)
                                .await
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
                            let sql = format!(
                                "UPDATE `{}` SET `{}` = ? WHERE `{}` = ?",
                                table_name, change.column, primary_key_column
                            );
                            sqlx::query(&sql)
                                .bind(json_to_string(&change.new_value))
                                .bind(&change.row_id)
                                .execute(&mut *tx)
                                .await
                        }
                        "delete" => {
                            let sql = format!(
                                "DELETE FROM `{}` WHERE `{}` = ?",
                                table_name, primary_key_column
                            );
                            sqlx::query(&sql)
                                .bind(&change.row_id)
                                .execute(&mut *tx)
                                .await
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
                            let sql = format!(
                                "UPDATE \"{}\" SET \"{}\" = ? WHERE \"{}\" = ?",
                                table_name, change.column, primary_key_column
                            );
                            sqlx::query(&sql)
                                .bind(json_to_string(&change.new_value))
                                .bind(&change.row_id)
                                .execute(&mut *tx)
                                .await
                        }
                        "delete" => {
                            let sql = format!(
                                "DELETE FROM \"{}\" WHERE \"{}\" = ?",
                                table_name, primary_key_column
                            );
                            sqlx::query(&sql)
                                .bind(&change.row_id)
                                .execute(&mut *tx)
                                .await
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

/// Helper to convert JSON value to string for binding
fn json_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => Some(value.to_string()),
    }
}
