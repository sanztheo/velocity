use crate::error::VelocityError;
use super::enums::DatabasePool;
use super::types::TableData;
use super::metadata::get_table_schema;
use sqlx::Row;
use futures::TryStreamExt;
use mongodb::bson::Document;

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
        DatabasePool::MongoDB(mongo_pool) => {
            let db = mongo_pool.client.database(&mongo_pool.database);
            let collection = db.collection::<Document>(table_name);
            
            // Fetch documents with limit and skip
            let cursor = collection
                .find(mongodb::bson::doc! {})
                .limit(limit as i64)
                .skip(offset as u64)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            
            let docs: Vec<Document> = cursor
                .try_collect()
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            
            if docs.is_empty() {
                return Ok(TableData {
                    columns: vec!["_id".into()],
                    rows: vec![],
                });
            }
            
            // Extract column names from all documents (MongoDB is schemaless)
            let mut column_set = std::collections::HashSet::new();
            for doc in &docs {
                for key in doc.keys() {
                    column_set.insert(key.clone());
                }
            }
            let mut columns: Vec<String> = column_set.into_iter().collect();
            columns.sort();
            // Ensure _id is first
            if let Some(idx) = columns.iter().position(|c| c == "_id") {
                columns.remove(idx);
                columns.insert(0, "_id".to_string());
            }
            
            // Convert documents to rows
            let rows: Vec<Vec<serde_json::Value>> = docs
                .into_iter()
                .map(|doc| {
                    columns
                        .iter()
                        .map(|col| {
                            doc.get(col)
                                .map(|bson| bson_to_json(bson))
                                .unwrap_or(serde_json::Value::Null)
                        })
                        .collect()
                })
                .collect();
            
            Ok(TableData { columns, rows })
        }
    }
}

/// Convert BSON value to JSON value
fn bson_to_json(bson: &mongodb::bson::Bson) -> serde_json::Value {
    use mongodb::bson::Bson;
    match bson {
        Bson::Null => serde_json::Value::Null,
        Bson::Boolean(b) => serde_json::Value::Bool(*b),
        Bson::Int32(i) => serde_json::Value::Number((*i).into()),
        Bson::Int64(i) => serde_json::Value::Number((*i).into()),
        Bson::Double(f) => serde_json::Number::from_f64(*f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Bson::String(s) => serde_json::Value::String(s.clone()),
        Bson::ObjectId(oid) => serde_json::Value::String(oid.to_hex()),
        Bson::DateTime(dt) => serde_json::Value::String(dt.to_string()),
        Bson::Array(arr) => serde_json::Value::Array(
            arr.iter().map(bson_to_json).collect()
        ),
        Bson::Document(doc) => {
            let map: serde_json::Map<String, serde_json::Value> = doc
                .iter()
                .map(|(k, v)| (k.clone(), bson_to_json(v)))
                .collect();
            serde_json::Value::Object(map)
        }
        Bson::Binary(bin) => serde_json::Value::String(format!("<binary {} bytes>", bin.bytes.len())),
        _ => serde_json::Value::String(bson.to_string()),
    }
}

/// Get distinct values for a column (for autocompletion)
pub async fn get_column_values(
    pool: &DatabasePool,
    table_name: &str,
    column: &str,
    limit: i32,
) -> Result<Vec<String>, VelocityError> {
    let query = format!(
        "SELECT DISTINCT {} FROM {} ORDER BY {} LIMIT {}",
        column, table_name, column, limit
    );

    match pool {
        DatabasePool::Postgres(pool) => {
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            
            let values: Vec<String> = rows
                .iter()
                .map(|row| {
                    use sqlx::Row;
                    row.try_get::<String, _>(0)
                        .or_else(|_| row.try_get::<i64, _>(0).map(|v| v.to_string()))
                        .or_else(|_| row.try_get::<i32, _>(0).map(|v| v.to_string()))
                        .or_else(|_| row.try_get::<bool, _>(0).map(|v| v.to_string()))
                        .unwrap_or_else(|_| "".to_string())
                })
                .filter(|s| !s.is_empty())
                .collect();
            Ok(values)
        }
        DatabasePool::MySQL(pool) => {
            let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            
            let values: Vec<String> = rows
                .iter()
                .map(|row| {
                    use sqlx::Row;
                    row.try_get::<String, _>(0)
                        .or_else(|_| row.try_get::<i64, _>(0).map(|v| v.to_string()))
                        .or_else(|_| row.try_get::<i32, _>(0).map(|v| v.to_string()))
                        .or_else(|_| row.try_get::<bool, _>(0).map(|v| v.to_string()))
                        .unwrap_or_else(|_| "".to_string())
                })
                .filter(|s| !s.is_empty())
                .collect();
            Ok(values)
        }
        DatabasePool::SQLite(pool) => {
             let rows = sqlx::query(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            
             let values: Vec<String> = rows
                .iter()
                .map(|row| {
                    use sqlx::Row;
                    row.try_get::<String, _>(0)
                        .or_else(|_| row.try_get::<i64, _>(0).map(|v| v.to_string()))
                        .or_else(|_| row.try_get::<i32, _>(0).map(|v| v.to_string()))
                        .or_else(|_| row.try_get::<bool, _>(0).map(|v| v.to_string()))
                        .unwrap_or_else(|_| "".to_string())
                })
                .filter(|s| !s.is_empty())
                .collect();
            Ok(values)
        }
        DatabasePool::SQLServer(_) => Ok(vec![]),
        DatabasePool::Redis(_) => Ok(vec![]),
        DatabasePool::MongoDB(mongo_pool) => {
             let db = mongo_pool.client.database(&mongo_pool.database);
             let collection = db.collection::<Document>(table_name);
             
             // Use aggregation to get distinct values with limit
             let pipeline = vec![
                 mongodb::bson::doc! { "$group": { "_id": format!("${}", column) } },
                 mongodb::bson::doc! { "$limit": limit as i64 },
                 mongodb::bson::doc! { "$project": { "_id": 0, "value": "$_id" } }
             ];
             
             let cursor = collection
                 .aggregate(pipeline)
                 .await
                 .map_err(|e| VelocityError::Query(e.to_string()))?;
                 
             let docs: Vec<Document> = cursor
                 .try_collect()
                 .await
                 .map_err(|e| VelocityError::Query(e.to_string()))?;
                 
             let values: Vec<String> = docs
                 .iter()
                 .filter_map(|doc| {
                     doc.get("value").map(|bson| match bson {
                         mongodb::bson::Bson::String(s) => s.clone(),
                         mongodb::bson::Bson::Int32(i) => i.to_string(),
                         mongodb::bson::Bson::Int64(i) => i.to_string(),
                         mongodb::bson::Bson::Boolean(b) => b.to_string(),
                         _ => "".to_string(),
                     })
                 })
                 .filter(|s| !s.is_empty())
                 .collect();
                 
             Ok(values)
        }
    }
}
