use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,                    // UUID v4
    pub name: String,                  // Nom affiché
    pub db_type: DatabaseType,         // SQLite | PostgreSQL | MySQL
    pub config: ConnectionConfig,      // Config spécifique
    pub favorite: bool,                // Marqué favori
    pub color: Option<String>,         // Couleur badge (#hex)
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
        password: Option<String>,      // Chiffré ou non stocké
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SslConfig {
    pub enabled: bool,
    pub mode: SslMode,                 // Disable | Prefer | Require | VerifyCA | VerifyFull
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
}
