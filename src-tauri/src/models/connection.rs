use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub db_type: DatabaseType,
    pub config: ConnectionConfig,
    pub favorite: bool,
    pub color: Option<String>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ConnectionConfig {
    SQLite {
        path: PathBuf,
    },
    PostgreSQL {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
        ssl: SslConfig,
    },
    MySQL {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
        ssl: SslConfig,
    },
    MariaDB {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
        ssl: SslConfig,
    },
    CockroachDB {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
        ssl: SslConfig,
    },
    Redshift {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
        ssl: SslConfig,
    },
    SQLServer {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
        encrypt: bool,
        #[serde(rename = "trustServerCertificate")]
        trust_server_certificate: bool,
    },
    Redis {
        host: String,
        port: u16,
        username: Option<String>,
        password: Option<String>,
        database: u8,
        #[serde(rename = "useTls")]
        use_tls: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SslConfig {
    pub enabled: bool,
    pub mode: SslMode,
    pub ca_cert_path: Option<PathBuf>,
    pub client_cert_path: Option<PathBuf>,
    pub client_key_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SslMode {
    Disable,
    Prefer,
    Require,
    VerifyCA,
    VerifyFull,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DatabaseType {
    SQLite,
    PostgreSQL,
    MySQL,
    MariaDB,
    CockroachDB,
    Redshift,
    SQLServer,
    Redis,
}
