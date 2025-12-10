//! Table data fetching with filters, sorting, and pagination
//!
//! This module handles the actual data retrieval from databases,
//! keeping this logic separate from the connection pool management.

use crate::db::filters::QueryOptions;
use crate::db::pool::{ColumnInfo, DatabasePool};
use crate::error::VelocityError;
use sqlx::Row;

/// Response for table data with total count for pagination
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDataResponse {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_count: i64,
}

/// Fetch table data with filtering, sorting, and pagination
pub async fn fetch_table_data(
    pool: &DatabasePool,
    table_name: &str,
    columns: &[ColumnInfo],
    options: &QueryOptions,
) -> Result<TableDataResponse, VelocityError> {
    let column_names: Vec<String> = columns.iter().map(|c| c.name.clone()).collect();

    // Build query parts
    let (where_clause, _params) = options.build_where_clause();
    let order_clause = options.build_order_clause();
    let pagination = options.build_pagination_clause();

    // For now, use simple string interpolation (safe because column names come from schema)
    // TODO: Use proper parameterized queries for filter values
    let query = format!(
        "SELECT * FROM \"{}\"{}{}{}",
        table_name, where_clause, order_clause, pagination
    );

    let count_query = format!(
        "SELECT COUNT(*) as count FROM \"{}\"{}",
        table_name, where_clause
    );

    match pool {
        DatabasePool::Postgres(pool) => {
            // Get total count
            let count_row = sqlx::query(&count_query)
                .fetch_one(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            let total_count: i64 = count_row.try_get("count").unwrap_or(0);

            // Get data
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            let data = rows
                .iter()
                .map(|row| {
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| row_value_to_json(row, i))
                        .collect()
                })
                .collect();

            Ok(TableDataResponse {
                columns: column_names,
                rows: data,
                total_count,
            })
        }
        DatabasePool::MySQL(pool) => {
            // Get total count
            let count_row = sqlx::query(&count_query)
                .fetch_one(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            let total_count: i64 = count_row.try_get("count").unwrap_or(0);

            // Get data
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            let data = rows
                .iter()
                .map(|row| {
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| row_value_to_json_mysql(row, i))
                        .collect()
                })
                .collect();

            Ok(TableDataResponse {
                columns: column_names,
                rows: data,
                total_count,
            })
        }
        DatabasePool::SQLite(pool) => {
            // Get total count
            let count_row = sqlx::query(&count_query)
                .fetch_one(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            let total_count: i64 = count_row.try_get("count").unwrap_or(0);

            // Get data
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            let data = rows
                .iter()
                .map(|row| {
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| row_value_to_json_sqlite(row, i))
                        .collect()
                })
                .collect();

            Ok(TableDataResponse {
                columns: column_names,
                rows: data,
                total_count,
            })
        }
        DatabasePool::Redis(_) => Err(VelocityError::Query(
            "Redis does not support table data fetching".to_string(),
        )),
        DatabasePool::SQLServer(_) => Err(VelocityError::Query(
            "SQL Server support coming soon".to_string(),
        )),
    }
}

/// Convert PostgreSQL row value to JSON
fn row_value_to_json(row: &sqlx::postgres::PgRow, index: usize) -> serde_json::Value {
    row.try_get::<String, _>(index)
        .map(serde_json::Value::String)
        .or_else(|_| {
            row.try_get::<i64, _>(index)
                .map(|v| serde_json::Value::Number(v.into()))
        })
        .or_else(|_| {
            row.try_get::<i32, _>(index)
                .map(|v| serde_json::Value::Number(v.into()))
        })
        .or_else(|_| {
            row.try_get::<f64, _>(index).map(|v| {
                serde_json::Number::from_f64(v)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            })
        })
        .or_else(|_| row.try_get::<bool, _>(index).map(serde_json::Value::Bool))
        .unwrap_or(serde_json::Value::Null)
}

/// Convert MySQL row value to JSON
fn row_value_to_json_mysql(row: &sqlx::mysql::MySqlRow, index: usize) -> serde_json::Value {
    row.try_get::<String, _>(index)
        .map(serde_json::Value::String)
        .or_else(|_| {
            row.try_get::<i64, _>(index)
                .map(|v| serde_json::Value::Number(v.into()))
        })
        .or_else(|_| {
            row.try_get::<i32, _>(index)
                .map(|v| serde_json::Value::Number(v.into()))
        })
        .or_else(|_| row.try_get::<bool, _>(index).map(serde_json::Value::Bool))
        .unwrap_or(serde_json::Value::Null)
}

/// Convert SQLite row value to JSON
fn row_value_to_json_sqlite(row: &sqlx::sqlite::SqliteRow, index: usize) -> serde_json::Value {
    row.try_get::<String, _>(index)
        .map(serde_json::Value::String)
        .or_else(|_| {
            row.try_get::<i64, _>(index)
                .map(|v| serde_json::Value::Number(v.into()))
        })
        .or_else(|_| {
            row.try_get::<i32, _>(index)
                .map(|v| serde_json::Value::Number(v.into()))
        })
        .or_else(|_| row.try_get::<bool, _>(index).map(serde_json::Value::Bool))
        .unwrap_or(serde_json::Value::Null)
}
