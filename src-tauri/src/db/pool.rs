use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use sqlx::{Pool, Postgres, MySql, Sqlite};
use crate::error::VelocityError;
use crate::models::connection::{Connection, ConnectionConfig};

/// Enum to hold different database pool types
pub enum DatabasePool {
    Postgres(Pool<Postgres>),
    MySQL(Pool<MySql>),
    SQLite(Pool<Sqlite>),
    // SQL Server uses a different connection type
    SQLServer(SqlServerPool),
    // Redis uses its own client
    Redis(RedisPool),
}

/// SQL Server connection wrapper
pub struct SqlServerPool {
    config: tiberius::Config,
}

/// Redis connection wrapper  
pub struct RedisPool {
    client: redis::Client,
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
            ConnectionConfig::PostgreSQL { host, port, database, username, password, .. } |
            ConnectionConfig::CockroachDB { host, port, database, username, password, .. } |
            ConnectionConfig::Redshift { host, port, database, username, password, .. } => {
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
            ConnectionConfig::MySQL { host, port, database, username, password, .. } |
            ConnectionConfig::MariaDB { host, port, database, username, password, .. } => {
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
            ConnectionConfig::SQLServer { host, port, database, username, password, encrypt, trust_server_certificate } => {
                use tokio::net::TcpStream;
                use tokio_util::compat::TokioAsyncWriteCompatExt;
                
                let mut config = tiberius::Config::new();
                config.host(host);
                config.port(*port);
                config.database(database);
                config.authentication(tiberius::AuthMethod::sql_server(username, password.as_deref().unwrap_or("")));
                
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
                tcp.set_nodelay(true).map_err(|e| VelocityError::Connection(e.to_string()))?;
                
                let mut client = tiberius::Client::connect(config, tcp.compat_write())
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                
                // Test query
                client.simple_query("SELECT 1")
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                Ok(())
            }
            ConnectionConfig::Redis { host, port, password, database, use_tls } => {
                let url = if let Some(pwd) = password {
                    if *use_tls {
                        format!("rediss://:{}@{}:{}/{}", pwd, host, port, database)
                    } else {
                        format!("redis://:{}@{}:{}/{}", pwd, host, port, database)
                    }
                } else {
                    if *use_tls {
                        format!("rediss://{}:{}/{}", host, port, database)
                    } else {
                        format!("redis://{}:{}/{}", host, port, database)
                    }
                };
                
                let client = redis::Client::open(url)
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                
                let mut conn = client.get_multiplexed_async_connection()
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                
                // Test with PING
                redis::cmd("PING")
                    .query_async::<String>(&mut conn)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                
                Ok(())
            }
        }
    }

    /// Connect and store the pool
    pub async fn connect(&self, connection: &Connection) -> Result<(), VelocityError> {
        let pool = match &connection.config {
            ConnectionConfig::PostgreSQL { host, port, database, username, password, .. } |
            ConnectionConfig::CockroachDB { host, port, database, username, password, .. } |
            ConnectionConfig::Redshift { host, port, database, username, password, .. } => {
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
            ConnectionConfig::MySQL { host, port, database, username, password, .. } |
            ConnectionConfig::MariaDB { host, port, database, username, password, .. } => {
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
            ConnectionConfig::SQLServer { host, port, database, username, password, encrypt, trust_server_certificate } => {
                let mut config = tiberius::Config::new();
                config.host(host);
                config.port(*port);
                config.database(database);
                config.authentication(tiberius::AuthMethod::sql_server(username, password.as_deref().unwrap_or("")));
                
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
            ConnectionConfig::Redis { host, port, password, database, use_tls } => {
                let url = if let Some(pwd) = password {
                    if *use_tls {
                        format!("rediss://:{}@{}:{}/{}", pwd, host, port, database)
                    } else {
                        format!("redis://:{}@{}:{}/{}", pwd, host, port, database)
                    }
                } else {
                    if *use_tls {
                        format!("rediss://{}:{}/{}", host, port, database)
                    } else {
                        format!("redis://{}:{}/{}", host, port, database)
                    }
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
            match Arc::try_unwrap(pool) {
                Ok(p) => {
                    match p {
                        DatabasePool::Postgres(pool) => pool.close().await,
                        DatabasePool::MySQL(pool) => pool.close().await,
                        DatabasePool::SQLite(pool) => pool.close().await,
                        DatabasePool::SQLServer(_) => {}, // No explicit close needed
                        DatabasePool::Redis(_) => {}, // No explicit close needed
                    }
                }
                Err(_) => {}
            }
        }
        Ok(())
    }

    /// Check if a connection is active
    pub async fn is_connected(&self, connection_id: &str) -> bool {
        let pools = self.pools.read().await;
        pools.contains_key(connection_id)
    }

    /// Get pool for a connection
    pub async fn get_pool(&self, connection_id: &str) -> Option<Arc<DatabasePool>> {
        let pools = self.pools.read().await;
        pools.get(connection_id).cloned()
    }

    /// List databases for a connection
    pub async fn list_databases(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self.get_pool(connection_id).await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
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
            DatabasePool::SQLite(_) => {
                Ok(vec!["main".to_string()])
            }
            DatabasePool::SQLServer(_) => {
                // Would need to execute query via tiberius
                Ok(vec!["master".to_string()])
            }
            DatabasePool::Redis(_) => {
                // Redis has 16 databases (0-15)
                Ok((0..16).map(|i| format!("db{}", i)).collect())
            }
        }
    }

    /// List tables for a connection
    pub async fn list_tables(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self.get_pool(connection_id).await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
                )
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                
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
                )
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                Ok(rows.into_iter().map(|r| r.0).collect())
            }
            DatabasePool::SQLServer(_) => {
                // Would need tiberius query
                Ok(vec![])
            }
            DatabasePool::Redis(redis_pool) => {
                // Redis uses KEYS command instead of tables
                let mut conn = redis_pool.client.get_multiplexed_async_connection()
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

    /// Get table schema (columns info)
    pub async fn get_table_schema(&self, connection_id: &str, table_name: &str) -> Result<Vec<ColumnInfo>, VelocityError> {
        let pool = self.get_pool(connection_id).await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String, String, String, Option<i32>)> = sqlx::query_as(
                    r#"
                    SELECT 
                        column_name,
                        data_type,
                        CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END,
                        character_maximum_length
                    FROM information_schema.columns 
                    WHERE table_name = $1 AND table_schema = 'public'
                    ORDER BY ordinal_position
                    "#
                )
                .bind(table_name)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                Ok(rows.into_iter().map(|(name, data_type, nullable, max_length)| {
                    ColumnInfo {
                        name,
                        data_type,
                        nullable: nullable == "YES",
                        max_length,
                        is_primary_key: false,
                    }
                }).collect())
            }
            DatabasePool::MySQL(pool) => {
                let rows: Vec<(String, String, String, Option<i64>)> = sqlx::query_as(
                    r#"
                    SELECT 
                        COLUMN_NAME,
                        DATA_TYPE,
                        IS_NULLABLE,
                        CHARACTER_MAXIMUM_LENGTH
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = ?
                    ORDER BY ORDINAL_POSITION
                    "#
                )
                .bind(table_name)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                Ok(rows.into_iter().map(|(name, data_type, nullable, max_length)| {
                    ColumnInfo {
                        name,
                        data_type,
                        nullable: nullable == "YES",
                        max_length: max_length.map(|l| l as i32),
                        is_primary_key: false,
                    }
                }).collect())
            }
            DatabasePool::SQLite(pool) => {
                let rows: Vec<(String, String, i32)> = sqlx::query_as(
                    &format!("PRAGMA table_info({})", table_name)
                )
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                Ok(rows.into_iter().map(|(name, data_type, notnull)| {
                    ColumnInfo {
                        name,
                        data_type,
                        nullable: notnull == 0,
                        max_length: None,
                        is_primary_key: false,
                    }
                }).collect())
            }
            DatabasePool::SQLServer(_) => {
                // Would need tiberius implementation
                Ok(vec![])
            }
            DatabasePool::Redis(_) => {
                // Redis doesn't have schemas - return key type
                Ok(vec![ColumnInfo {
                    name: "value".to_string(),
                    data_type: "string".to_string(),
                    nullable: true,
                    max_length: None,
                    is_primary_key: false,
                }])
            }
        }
    }

    /// Get table data with pagination
    pub async fn get_table_data(
        &self, 
        connection_id: &str, 
        table_name: &str,
        limit: i32,
        offset: i32
    ) -> Result<TableData, VelocityError> {
        let pool = self.get_pool(connection_id).await
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
                
                let data: Vec<Vec<serde_json::Value>> = rows.iter().map(|row| {
                    use sqlx::Row;
                    column_names.iter().enumerate().map(|(i, _)| {
                        if let Ok(v) = row.try_get::<String, _>(i) {
                            serde_json::Value::String(v)
                        } else if let Ok(v) = row.try_get::<i64, _>(i) {
                            serde_json::Value::Number(v.into())
                        } else if let Ok(v) = row.try_get::<i32, _>(i) {
                            serde_json::Value::Number(v.into())
                        } else if let Ok(v) = row.try_get::<f64, _>(i) {
                            serde_json::Number::from_f64(v)
                                .map(serde_json::Value::Number)
                                .unwrap_or(serde_json::Value::Null)
                        } else if let Ok(v) = row.try_get::<bool, _>(i) {
                            serde_json::Value::Bool(v)
                        } else {
                            serde_json::Value::Null
                        }
                    }).collect()
                }).collect();

                Ok(TableData { columns: column_names, rows: data })
            }
            DatabasePool::MySQL(pool) => {
                let rows = sqlx::query(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                let data: Vec<Vec<serde_json::Value>> = rows.iter().map(|row| {
                    use sqlx::Row;
                    column_names.iter().enumerate().map(|(i, _)| {
                        if let Ok(v) = row.try_get::<String, _>(i) {
                            serde_json::Value::String(v)
                        } else if let Ok(v) = row.try_get::<i64, _>(i) {
                            serde_json::Value::Number(v.into())
                        } else if let Ok(v) = row.try_get::<i32, _>(i) {
                            serde_json::Value::Number(v.into())
                        } else if let Ok(v) = row.try_get::<bool, _>(i) {
                            serde_json::Value::Bool(v)
                        } else {
                            serde_json::Value::Null
                        }
                    }).collect()
                }).collect();

                Ok(TableData { columns: column_names, rows: data })
            }
            DatabasePool::SQLite(pool) => {
                let rows = sqlx::query(&query)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                let data: Vec<Vec<serde_json::Value>> = rows.iter().map(|row| {
                    use sqlx::Row;
                    column_names.iter().enumerate().map(|(i, _)| {
                        if let Ok(v) = row.try_get::<String, _>(i) {
                            serde_json::Value::String(v)
                        } else if let Ok(v) = row.try_get::<i64, _>(i) {
                            serde_json::Value::Number(v.into())
                        } else if let Ok(v) = row.try_get::<i32, _>(i) {
                            serde_json::Value::Number(v.into())
                        } else if let Ok(v) = row.try_get::<bool, _>(i) {
                            serde_json::Value::Bool(v)
                        } else {
                            serde_json::Value::Null
                        }
                    }).collect()
                }).collect();

                Ok(TableData { columns: column_names, rows: data })
            }
            DatabasePool::SQLServer(_) => {
                // Would need tiberius implementation
                Ok(TableData { columns: vec![], rows: vec![] })
            }
            DatabasePool::Redis(redis_pool) => {
                // For Redis, table_name is actually a key pattern or specific key
                let mut conn = redis_pool.client.get_multiplexed_async_connection()
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;
                
                // Get the value of the key
                let value: Option<String> = redis::cmd("GET")
                    .arg(table_name)
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                
                let rows = if let Some(v) = value {
                    vec![vec![serde_json::Value::String(v)]]
                } else {
                    vec![]
                };
                
                Ok(TableData { 
                    columns: vec!["value".to_string()], 
                    rows 
                })
            }
        }
    }
}

/// Column information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub max_length: Option<i32>,
    pub is_primary_key: bool,
}

/// Table data result
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
