//! Query execution module for SQL Editor
//!
//! Handles raw SQL query execution and EXPLAIN plans for all database types.

use crate::commands::database::{ExplainResult, QueryResultData};
use crate::db::{ConnectionPoolManager, DatabasePool};
use crate::error::VelocityError;
use sqlx::{Column, Row};

impl ConnectionPoolManager {
    /// Execute raw SQL query and return results
    pub async fn execute_query(
        &self,
        connection_id: &str,
        sql: &str,
    ) -> Result<QueryResultData, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => Self::execute_postgres_query(pool, sql).await,
            DatabasePool::MySQL(pool) => Self::execute_mysql_query(pool, sql).await,
            DatabasePool::SQLite(pool) => Self::execute_sqlite_query(pool, sql).await,
            _ => Err(VelocityError::Query(
                "Query execution not supported for this database type".to_string(),
            )),
        }
    }

    /// Execute PostgreSQL query
    async fn execute_postgres_query(
        pool: &sqlx::Pool<sqlx::Postgres>,
        sql: &str,
    ) -> Result<QueryResultData, VelocityError> {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

        let columns: Vec<String> = if !rows.is_empty() {
            rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect()
        } else {
            vec![]
        };

        let data: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                (0..columns.len())
                    .map(|i| Self::extract_pg_value(row, i))
                    .collect()
            })
            .collect();

        let row_count = data.len() as i64;
        Ok(QueryResultData {
            columns,
            rows: data,
            row_count,
        })
    }

    /// Extract value from PostgreSQL row
    fn extract_pg_value(row: &sqlx::postgres::PgRow, i: usize) -> serde_json::Value {
        if let Ok(v) = row.try_get::<Option<String>, _>(i) {
            v.map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<Option<i64>, _>(i) {
            v.map(|n| serde_json::Value::Number(n.into()))
                .unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<Option<f64>, _>(i) {
            v.and_then(|n| serde_json::Number::from_f64(n))
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<Option<bool>, _>(i) {
            v.map(serde_json::Value::Bool)
                .unwrap_or(serde_json::Value::Null)
        } else {
            serde_json::Value::Null
        }
    }

    /// Execute MySQL query
    async fn execute_mysql_query(
        pool: &sqlx::Pool<sqlx::MySql>,
        sql: &str,
    ) -> Result<QueryResultData, VelocityError> {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

        let columns: Vec<String> = if !rows.is_empty() {
            rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect()
        } else {
            vec![]
        };

        let data: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                (0..columns.len())
                    .map(|i| Self::extract_mysql_value(row, i))
                    .collect()
            })
            .collect();

        let row_count = data.len() as i64;
        Ok(QueryResultData {
            columns,
            rows: data,
            row_count,
        })
    }

    /// Extract value from MySQL row
    fn extract_mysql_value(row: &sqlx::mysql::MySqlRow, i: usize) -> serde_json::Value {
        if let Ok(v) = row.try_get::<Option<String>, _>(i) {
            v.map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<Option<i64>, _>(i) {
            v.map(|n| serde_json::Value::Number(n.into()))
                .unwrap_or(serde_json::Value::Null)
        } else {
            serde_json::Value::Null
        }
    }

    /// Execute SQLite query
    async fn execute_sqlite_query(
        pool: &sqlx::Pool<sqlx::Sqlite>,
        sql: &str,
    ) -> Result<QueryResultData, VelocityError> {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

        let columns: Vec<String> = if !rows.is_empty() {
            rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect()
        } else {
            vec![]
        };

        let data: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                (0..columns.len())
                    .map(|i| Self::extract_sqlite_value(row, i))
                    .collect()
            })
            .collect();

        let row_count = data.len() as i64;
        Ok(QueryResultData {
            columns,
            rows: data,
            row_count,
        })
    }

    /// Extract value from SQLite row
    fn extract_sqlite_value(row: &sqlx::sqlite::SqliteRow, i: usize) -> serde_json::Value {
        if let Ok(v) = row.try_get::<Option<String>, _>(i) {
            v.map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<Option<i64>, _>(i) {
            v.map(|n| serde_json::Value::Number(n.into()))
                .unwrap_or(serde_json::Value::Null)
        } else {
            serde_json::Value::Null
        }
    }

    /// Get query execution plan (EXPLAIN)
    pub async fn explain_query(
        &self,
        connection_id: &str,
        sql: &str,
    ) -> Result<ExplainResult, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

        let explain_sql = match pool.as_ref() {
            DatabasePool::Postgres(_) => format!("EXPLAIN ANALYZE {}", sql),
            DatabasePool::MySQL(_) => format!("EXPLAIN {}", sql),
            DatabasePool::SQLite(_) => format!("EXPLAIN QUERY PLAN {}", sql),
            _ => return Err(VelocityError::Query("EXPLAIN not supported".to_string())),
        };

        match pool.as_ref() {
            DatabasePool::Postgres(pool) => {
                let rows: Vec<(String,)> = sqlx::query_as(&explain_sql)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Ok(ExplainResult {
                    plan: rows.into_iter().map(|r| r.0).collect(),
                })
            }
            DatabasePool::MySQL(pool) => {
                let rows = sqlx::query(&explain_sql)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                let plan: Vec<String> = rows.iter().map(|row| format!("{:?}", row)).collect();
                Ok(ExplainResult { plan })
            }
            DatabasePool::SQLite(pool) => {
                let rows: Vec<(i32, i32, i32, String)> = sqlx::query_as(&explain_sql)
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                let plan: Vec<String> = rows
                    .into_iter()
                    .map(|(_, parent, _, detail)| format!("parent:{} {}", parent, detail))
                    .collect();
                Ok(ExplainResult { plan })
            }
            _ => Err(VelocityError::Query("EXPLAIN not supported".to_string())),
        }
    }
}
