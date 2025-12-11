use sqlx::{Pool, Postgres, MySql, Sqlite};
use super::types::{SqlServerPool, RedisPool, MongoPool};

/// Enum to hold different database pool types
pub enum DatabasePool {
    Postgres(Pool<Postgres>),
    MySQL(Pool<MySql>),
    SQLite(Pool<Sqlite>),
    // SQL Server uses a different connection type - config for lazy connect
    SQLServer(SqlServerPool),
    // Redis client
    Redis(RedisPool),
    // MongoDB client
    MongoDB(MongoPool),
}
