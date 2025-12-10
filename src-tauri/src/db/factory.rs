use crate::db::pool::{DatabasePool, RedisPool, SqlServerPool};
use crate::error::VelocityError;
use crate::models::connection::{Connection, ConnectionConfig, SslMode};
use sqlx::{ConnectOptions, MySql, Pool, Postgres, Sqlite};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncWriteCompatExt;

pub struct DatabaseFactory;

impl DatabaseFactory {
    pub async fn create_pool(connection: &Connection) -> Result<DatabasePool, VelocityError> {
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
                    .max_connections(5)
                    .acquire_timeout(std::time::Duration::from_secs(10))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                Ok(DatabasePool::Postgres(pool))
            }
            ConnectionConfig::MySQL {
                host,
                port,
                database,
                username,
                password,
                ssl,
                ..
            }
            | ConnectionConfig::MariaDB {
                host,
                port,
                database,
                username,
                password,
                ssl,
                ..
            } => {
                let mut opts = sqlx::mysql::MySqlConnectOptions::new()
                    .host(host)
                    .port(*port)
                    .username(username)
                    .database(database);

                if let Some(pwd) = password.as_deref().filter(|s| !s.is_empty()) {
                    opts = opts.password(pwd);
                }

                if ssl.enabled {
                    let mode = match ssl.mode {
                        SslMode::Disable => sqlx::mysql::MySqlSslMode::Disabled,
                        SslMode::Prefer => sqlx::mysql::MySqlSslMode::Preferred,
                        SslMode::Require => sqlx::mysql::MySqlSslMode::Required,
                        SslMode::VerifyCA => sqlx::mysql::MySqlSslMode::VerifyCa,
                        SslMode::VerifyFull => sqlx::mysql::MySqlSslMode::VerifyIdentity,
                    };
                    opts = opts.ssl_mode(mode);

                    if let Some(ca) = &ssl.ca_cert_path {
                        opts = opts.ssl_ca(&ca);
                    }
                }

                let pool = sqlx::mysql::MySqlPoolOptions::new()
                    .max_connections(5)
                    .min_connections(1) // Pre-establish at least one connection
                    .acquire_timeout(std::time::Duration::from_secs(120)) // 2 minutes for slow remote DBs
                    .idle_timeout(std::time::Duration::from_secs(600))
                    .connect_with(opts)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                Ok(DatabasePool::MySQL(pool))
            }
            ConnectionConfig::SQLite { path } => {
                let url = format!("sqlite:{}", path.display());

                let pool = sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(5)
                    .acquire_timeout(std::time::Duration::from_secs(10))
                    .connect(&url)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                Ok(DatabasePool::SQLite(pool))
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

                Ok(DatabasePool::SQLServer(SqlServerPool { config }))
            }
            ConnectionConfig::Redis {
                host,
                port,
                username,
                password,
                database,
                use_tls,
            } => {
                let scheme = if *use_tls { "rediss" } else { "redis" };
                let auth = match (username, password) {
                    (Some(user), Some(pwd)) => format!("{}:{}@", user, pwd),
                    (None, Some(pwd)) => format!(":{}@", pwd),
                    (Some(user), None) => format!("{}@", user),
                    (None, None) => String::new(),
                };
                let url = format!("{}://{}{}:{}/{}", scheme, auth, host, port, database);

                let client = redis::Client::open(url)
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                Ok(DatabasePool::Redis(RedisPool { client }))
            }
        }
    }

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
                ssl,
                ..
            }
            | ConnectionConfig::MariaDB {
                host,
                port,
                database,
                username,
                password,
                ssl,
                ..
            } => {
                let mut opts = sqlx::mysql::MySqlConnectOptions::new()
                    .host(host)
                    .port(*port)
                    .username(username)
                    .database(database);

                if let Some(pwd) = password.as_deref().filter(|s| !s.is_empty()) {
                    opts = opts.password(pwd);
                }

                if ssl.enabled {
                    let mode = match ssl.mode {
                        SslMode::Disable => sqlx::mysql::MySqlSslMode::Disabled,
                        SslMode::Prefer => sqlx::mysql::MySqlSslMode::Preferred,
                        SslMode::Require => sqlx::mysql::MySqlSslMode::Required,
                        SslMode::VerifyCA => sqlx::mysql::MySqlSslMode::VerifyCa,
                        SslMode::VerifyFull => sqlx::mysql::MySqlSslMode::VerifyIdentity,
                    };
                    opts = opts.ssl_mode(mode);

                    if let Some(ca) = &ssl.ca_cert_path {
                        opts = opts.ssl_ca(&ca);
                    }
                }

                let pool = sqlx::mysql::MySqlPoolOptions::new()
                    .max_connections(1)
                    .acquire_timeout(std::time::Duration::from_secs(10))
                    .connect_with(opts)
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
                username,
                password,
                database,
                use_tls,
            } => {
                let scheme = if *use_tls { "rediss" } else { "redis" };
                let auth = match (username, password) {
                    (Some(user), Some(pwd)) => format!("{}:{}@", user, pwd),
                    (None, Some(pwd)) => format!(":{}@", pwd),
                    (Some(user), None) => format!("{}@", user),
                    (None, None) => String::new(),
                };
                let url = format!("{}://{}{}:{}/{}", scheme, auth, host, port, database);

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
}
