
use tiberius;
use redis;

/// SQL Server connection wrapper
pub struct SqlServerPool {
    pub config: tiberius::Config,
}

/// Redis connection wrapper
pub struct RedisPool {
    pub client: redis::Client,
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
