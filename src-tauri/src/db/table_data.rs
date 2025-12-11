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
    /// Total count of rows matching filters (None if skip_count was true)
    pub total_count: Option<i64>,
    /// Next cursor value for pagination (last row's cursor column value)
    pub next_cursor: Option<serde_json::Value>,
}

/// Fetch table data with filtering, sorting, and pagination
pub async fn fetch_table_data(
    pool: &DatabasePool,
    table_name: &str,
    columns: &[ColumnInfo],
    options: &QueryOptions,
) -> Result<TableDataResponse, VelocityError> {
    // Use selected columns if specified, otherwise use all columns from schema
    let column_names: Vec<String> = match &options.selected_columns {
        Some(cols) if !cols.is_empty() => cols.clone(),
        _ => columns.iter().map(|c| c.name.clone()).collect(),
    };

    // Build query parts
    let (mut where_clause, _params) = options.build_where_clause();
    let order_clause = options.build_order_clause();
    let pagination = options.build_pagination_clause();
    let select_columns = options.build_select_columns();

    // Add cursor condition to WHERE clause if present
    if let Some((cursor_condition, _cursor_param)) = options.build_cursor_clause() {
        if where_clause.is_empty() {
            where_clause = format!(" WHERE {}", cursor_condition);
        } else {
            // Append cursor condition with AND
            where_clause = format!("{} AND {}", where_clause, cursor_condition);
        }
    }

    // Build the main data query
    let query = format!(
        "SELECT {} FROM \"{}\"{}{}{}",
        select_columns, table_name, where_clause, order_clause, pagination
    );

    // Build count query (skip if skip_count is true)
    let base_where = {
        let (w, _) = options.build_where_clause();
        w
    };
    let count_query = format!(
        "SELECT COUNT(*) as count FROM \"{}\"{}",
        table_name, base_where
    );

    // Helper to get next cursor value from last row
    let get_next_cursor = |rows: &[Vec<serde_json::Value>], cursor_col: &str| -> Option<serde_json::Value> {
        if let Some(cursor_config) = &options.cursor {
            if let Some(last_row) = rows.last() {
                // Find cursor column index
                if let Some(idx) = column_names.iter().position(|c| c == cursor_col) {
                    return last_row.get(idx).cloned();
                }
            }
        }
        None
    };

    match pool {
        DatabasePool::Postgres(pg_pool) => {
            // Get total count (skip if skip_count is true)
            let total_count: Option<i64> = if options.skip_count {
                None
            } else {
                let count_row = sqlx::query(&count_query)
                    .fetch_one(pg_pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Some(count_row.try_get("count").unwrap_or(0))
            };

            // Get data
            let rows = sqlx::query(&query)
                .fetch_all(pg_pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            let data: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| {
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| row_value_to_json(row, i))
                        .collect()
                })
                .collect();

            let next_cursor = options.cursor.as_ref()
                .and_then(|c| get_next_cursor(&data, &c.column));

            Ok(TableDataResponse {
                columns: column_names,
                rows: data,
                total_count,
                next_cursor,
            })
        }
        DatabasePool::MySQL(mysql_pool) => {
            // Get total count (skip if skip_count is true)
            let total_count: Option<i64> = if options.skip_count {
                None
            } else {
                let count_row = sqlx::query(&count_query)
                    .fetch_one(mysql_pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Some(count_row.try_get("count").unwrap_or(0))
            };

            // Get data
            let rows = sqlx::query(&query)
                .fetch_all(mysql_pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            let data: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| {
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| row_value_to_json_mysql(row, i))
                        .collect()
                })
                .collect();

            let next_cursor = options.cursor.as_ref()
                .and_then(|c| get_next_cursor(&data, &c.column));

            Ok(TableDataResponse {
                columns: column_names,
                rows: data,
                total_count,
                next_cursor,
            })
        }
        DatabasePool::SQLite(sqlite_pool) => {
            // Get total count (skip if skip_count is true)
            let total_count: Option<i64> = if options.skip_count {
                None
            } else {
                let count_row = sqlx::query(&count_query)
                    .fetch_one(sqlite_pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
                Some(count_row.try_get("count").unwrap_or(0))
            };

            // Get data
            let rows = sqlx::query(&query)
                .fetch_all(sqlite_pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            let data: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| {
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| row_value_to_json_sqlite(row, i))
                        .collect()
                })
                .collect();

            let next_cursor = options.cursor.as_ref()
                .and_then(|c| get_next_cursor(&data, &c.column));

            Ok(TableDataResponse {
                columns: column_names,
                rows: data,
                total_count,
                next_cursor,
            })
        }
        DatabasePool::Redis(_) => Err(VelocityError::Query(
            "Redis does not support table data fetching".to_string(),
        )),
        DatabasePool::SQLServer(_) => Err(VelocityError::Query(
            "SQL Server support coming soon".to_string(),
        )),
        DatabasePool::MongoDB(_) => Err(VelocityError::Query(
            "MongoDB uses get_table_data, not fetch_table_data".to_string(),
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
