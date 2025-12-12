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
        let timeout_duration = std::time::Duration::from_secs(connection.timeout_seconds.unwrap_or(60));

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

                let mut opts = sqlx::postgres::PgConnectOptions::from_url(&url.parse().map_err(|e: sqlx::Error| VelocityError::Connection(e.to_string()))?)
                     .map_err(|e| VelocityError::Connection(e.to_string()))?;

                 if connection.read_only {
                     // In Postgres, we can set default_transaction_read_only = 'on' for the session
                     opts = opts.options([("default_transaction_read_only", "on")]);
                 }

                let pool = sqlx::postgres::PgPoolOptions::new()
                    .max_connections(5)
                    .acquire_timeout(timeout_duration)
                    .connect_with(opts)
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

                // MySQL doesn't have a direct "session read only" option in connect options easily via sqlx without executing a query.
                // We will handle read-only enforcement in the application layer or via `after_connect` if needed.
                // However, for now, we rely on `execute_changes` check.

                let pool = sqlx::mysql::MySqlPoolOptions::new()
                    .max_connections(5)
                    .min_connections(1) // Pre-establish at least one connection
                    .acquire_timeout(timeout_duration.max(std::time::Duration::from_secs(10))) // Minimum 10s for MySQL
                    .idle_timeout(std::time::Duration::from_secs(600))
                    .connect_with(opts)
                    .await
                    .map_err(|e| VelocityError::Connection(e.to_string()))?;

                Ok(DatabasePool::MySQL(pool))
            }
            ConnectionConfig::SQLite { path } => {
                let url = format!("sqlite:{}", path.display());

                let mut opts = sqlx::sqlite::SqliteConnectOptions::new()
                    .filename(path)
                    .create_if_missing(true);

                if connection.read_only {
                     opts = opts.read_only(true);
                }

                let pool = sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(5)
                    .acquire_timeout(timeout_duration)
                    .connect_with(opts)
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
            ConnectionConfig::MongoDB {
                host,
                port,
                database,
                username,
                password,
                use_tls,
                auth_source,
            } => {
                // Build MongoDB connection URI
                let mut uri = String::from("mongodb://");
                
                // Add auth if present
                if let (Some(user), Some(pwd)) = (username, password) {
                    // URL encode credentials in case they contain special characters
                    let encoded_user = urlencoding::encode(user);
                    let encoded_pwd = urlencoding::encode(pwd);
                    uri.push_str(&format!("{}:{}@", encoded_user, encoded_pwd));
                }
                
                // Add host and port
                uri.push_str(&format!("{}:{}", host, port));
                
                // Add database if specified
                uri.push_str(&format!("/{}", database));
                
                // Add connection options
                let mut options = vec![];
                
                // Railway uses TCP proxy - must use direct connection
                options.push("directConnection=true".to_string());
                
                if *use_tls {
                    options.push("tls=true".to_string());
                }
                if let Some(auth) = auth_source {
                    options.push(format!("authSource={}", auth));
                }
                
                // Use configured timeout or default aggressive timeout for remote/proxy connections
                let timeout_ms = timeout_duration.as_millis().max(60000); // at least 60s for Mongo

                options.push(format!("connectTimeoutMS={}", timeout_ms));
                options.push(format!("serverSelectionTimeoutMS={}", timeout_ms));
                options.push(format!("socketTimeoutMS={}", timeout_ms));
                options.push("maxPoolSize=5".to_string());
                
                uri.push_str(&format!("?{}", options.join("&")));
                
                println!("[VELOCITY] MongoDB URI: mongodb://[hidden]@{}:{}/{}", host, port, database);
                
                let client_options = mongodb::options::ClientOptions::parse(&uri)
                    .await
                    .map_err(|e| VelocityError::Connection(format!("MongoDB parse error: {}", e)))?;
                
                let client = mongodb::Client::with_options(client_options)
                    .map_err(|e| VelocityError::Connection(format!("MongoDB client error: {}", e)))?;
                
                Ok(DatabasePool::MongoDB(crate::db::pool::MongoPool {
                    client,
                    database: database.clone(),
                }))
            }
        }
    }

    pub async fn test_connection(connection: &Connection) -> Result<(), VelocityError> {
        let timeout_duration = std::time::Duration::from_secs(connection.timeout_seconds.unwrap_or(5));

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
                    .acquire_timeout(timeout_duration)
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
                    .acquire_timeout(timeout_duration)
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
                    .acquire_timeout(timeout_duration)
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
            ConnectionConfig::MongoDB {
                host,
                port,
                database,
                username,
                password,
                use_tls,
                auth_source,
            } => {
                // Build MongoDB connection URI (same as create_pool)
                let mut uri = String::from("mongodb://");
                
                if let (Some(user), Some(pwd)) = (username, password) {
                    let encoded_user = urlencoding::encode(user);
                    let encoded_pwd = urlencoding::encode(pwd);
                    uri.push_str(&format!("{}:{}@", encoded_user, encoded_pwd));
                }
                
                uri.push_str(&format!("{}:{}/{}", host, port, database));
                
                let mut options = vec![];
                options.push("directConnection=true".to_string());
                
                if *use_tls {
                    options.push("tls=true".to_string());
                }
                if let Some(auth) = auth_source {
                    options.push(format!("authSource={}", auth));
                }
                
                let timeout_ms = timeout_duration.as_millis().max(60000);

                options.push(format!("connectTimeoutMS={}", timeout_ms));
                options.push(format!("serverSelectionTimeoutMS={}", timeout_ms));
                options.push(format!("socketTimeoutMS={}", timeout_ms));
                
                uri.push_str(&format!("?{}", options.join("&")));
                
                println!("[VELOCITY] Testing MongoDB: {}:{}/{}", host, port, database);
                
                let client_options = mongodb::options::ClientOptions::parse(&uri)
                    .await
                    .map_err(|e| VelocityError::Connection(format!("MongoDB parse error: {}", e)))?;
                
                let client = mongodb::Client::with_options(client_options)
                    .map_err(|e| VelocityError::Connection(format!("MongoDB client error: {}", e)))?;
                
                // Ping the database to test connection
                let db = client.database(database);
                db.run_command(mongodb::bson::doc! { "ping": 1 })
                    .await
                    .map_err(|e| VelocityError::Connection(format!("MongoDB ping error: {}", e)))?;
                
                Ok(())
            }
        }
    }
}
