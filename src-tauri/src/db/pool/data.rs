use crate::error::VelocityError;
use super::enums::DatabasePool;
use super::types::TableData;
use super::metadata::get_table_schema;
use sqlx::Row;

pub async fn get_table_data(
    pool: &DatabasePool,
    table_name: &str,
    limit: i32,
    offset: i32,
) -> Result<TableData, VelocityError> {
    // Note: This logic was previously inside ConnectionPoolManager and called get_table_schema using `self`.
    // Now we need to call the standalone function get_table_schema.
    let columns = get_table_schema(pool, table_name).await?;
    let column_names: Vec<String> = columns.iter().map(|c| c.name.clone()).collect();
    let query = format!(
        "SELECT * FROM {} LIMIT {} OFFSET {}",
        table_name, limit, offset
    );

    match pool {
        DatabasePool::Postgres(pool) => {
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            let data = rows
                .iter()
                .map(|row| {
                    use sqlx::Row;
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| {
                            row.try_get::<String, _>(i)
                                .map(serde_json::Value::String)
                                .or_else(|_| {
                                    row.try_get::<i64, _>(i)
                                        .map(|v| serde_json::Value::Number(v.into()))
                                })
                                .or_else(|_| {
                                    row.try_get::<i32, _>(i)
                                        .map(|v| serde_json::Value::Number(v.into()))
                                })
                                .or_else(|_| {
                                    row.try_get::<bool, _>(i).map(serde_json::Value::Bool)
                                })
                                .unwrap_or(serde_json::Value::Null)
                        })
                        .collect()
                })
                .collect();
            Ok(TableData {
                columns: column_names,
                rows: data,
            })
        }
        DatabasePool::MySQL(pool) => {
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            let data = rows
                .iter()
                .map(|row| {
                    use sqlx::Row;
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| {
                            row.try_get::<String, _>(i)
                                .map(serde_json::Value::String)
                                .or_else(|_| {
                                    row.try_get::<i64, _>(i)
                                        .map(|v| serde_json::Value::Number(v.into()))
                                })
                                .or_else(|_| {
                                    row.try_get::<bool, _>(i).map(serde_json::Value::Bool)
                                })
                                .unwrap_or(serde_json::Value::Null)
                        })
                        .collect()
                })
                .collect();
            Ok(TableData {
                columns: column_names,
                rows: data,
            })
        }
        DatabasePool::SQLite(pool) => {
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            let data = rows
                .iter()
                .map(|row| {
                    use sqlx::Row;
                    column_names
                        .iter()
                        .enumerate()
                        .map(|(i, _)| {
                            row.try_get::<String, _>(i)
                                .map(serde_json::Value::String)
                                .or_else(|_| {
                                    row.try_get::<i64, _>(i)
                                        .map(|v| serde_json::Value::Number(v.into()))
                                })
                                .or_else(|_| {
                                    row.try_get::<bool, _>(i).map(serde_json::Value::Bool)
                                })
                                .unwrap_or(serde_json::Value::Null)
                        })
                        .collect()
                })
                .collect();
            Ok(TableData {
                columns: column_names,
                rows: data,
            })
        }
        DatabasePool::SQLServer(_) => Ok(TableData {
            columns: vec![],
            rows: vec![],
        }),
        DatabasePool::Redis(redis_pool) => {
            let mut conn = redis_pool
                .client
                .get_multiplexed_async_connection()
                .await
                .map_err(|e| VelocityError::Connection(e.to_string()))?;
            let value: Option<String> = redis::cmd("GET")
                .arg(table_name)
                .query_async(&mut conn)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            let rows = value
                .map(|v| vec![vec![serde_json::Value::String(v)]])
                .unwrap_or_default();
            Ok(TableData {
                columns: vec!["value".into()],
                rows,
            })
        }
    }
}
