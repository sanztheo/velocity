use crate::error::VelocityError;
use crate::commands::database::ForeignKeyInfo;
use super::enums::DatabasePool;
use super::types::ColumnInfo;
use sqlx::Row;

pub async fn list_databases(pool: &DatabasePool) -> Result<Vec<String>, VelocityError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            let rows: Vec<(String,)> = sqlx::query_as(
                "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
            )
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::MySQL(pool) => {
            let rows: Vec<(String,)> = sqlx::query_as("SHOW DATABASES")
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::SQLite(_) => Ok(vec!["main".to_string()]),
        DatabasePool::SQLServer(_) => Ok(vec!["master".to_string()]),
        DatabasePool::Redis(_) => Ok((0..16).map(|i| format!("db{}", i)).collect()),
        DatabasePool::MongoDB(mongo_pool) => {
            let dbs = mongo_pool.client
                .list_database_names()
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(dbs)
        }
    }
}

pub async fn list_tables(
    pool: &DatabasePool,
    limit: Option<u32>,
    offset: Option<u32>,
    search: Option<String>,
) -> Result<Vec<String>, VelocityError> {
    println!("[VELOCITY] Executing list_tables query...");

    match pool {
        DatabasePool::Postgres(pool) => {
            let mut query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public'".to_string();
            
            if let Some(s) = &search {
                // Using parameterized query would be better but for building dynamic query string with variable clauses
                // ensuring valid identifier characters or using basic sanitization is key.
                // For simplicity here, we assume standard LIKE. Ideally use bind.
                // Due to complexity of dynamic LIKE with sqlx query_as string, strict construction is needed.
                // We'll trust the input is reasonably safe or sanitized by frontend/tauri binding layer for now,
                // BUT better to just filter in WHERE.
                // Simpler approach:
                query.push_str(&format!(" AND tablename ILIKE '%{}%'", s.replace("'", "''")));
            }
            
            query.push_str(" ORDER BY tablename");

            if let Some(l) = limit {
                query.push_str(&format!(" LIMIT {}", l));
            }
            if let Some(o) = offset {
                query.push_str(&format!(" OFFSET {}", o));
            }

            let rows: Vec<(String,)> = sqlx::query_as(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::MySQL(pool) => {
            let mut query = "SHOW TABLES".to_string();
            let mut has_where = false;

            if let Some(s) = &search {
                query.push_str(&format!(" WHERE Tables_in_{} LIKE '%{}%'", "TODO_DB_NAME_FIX", s.replace("'", "''")));
                // SHOW TABLES doesn't easily support simple WHERE LIKE without knowing the db name col header in result
                // Actually MySQL 'SHOW TABLES LIKE' pattern is supported.
                query = format!("SHOW TABLES LIKE '%{}%'", s.replace("'", "''"));
            }
            
            // Re-apply limit/offset
            if let Some(l) = limit {
                query.push_str(&format!(" LIMIT {}", l));
            }
            if let Some(o) = offset {
                query.push_str(&format!(" OFFSET {}", o));
            }

            let rows: Vec<(String,)> = sqlx::query_as(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::SQLite(pool) => {
            let mut query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'".to_string();
            
            if let Some(s) = &search {
                query.push_str(&format!(" AND name LIKE '%{}%'", s.replace("'", "''")));
            }
            
            query.push_str(" ORDER BY name");

            if let Some(l) = limit {
                query.push_str(&format!(" LIMIT {}", l));
            }
            if let Some(o) = offset {
                query.push_str(&format!(" OFFSET {}", o));
            }

            let rows: Vec<(String,)> = sqlx::query_as(&query)
                .fetch_all(pool)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::SQLServer(_) => Ok(vec![]),
        DatabasePool::Redis(redis_pool) => {
            let mut conn = redis_pool
                .client
                .get_multiplexed_async_connection()
                .await
                .map_err(|e| VelocityError::Connection(e.to_string()))?;

            // Redis KEYS is case sensitive, but we can't easily do efficient case-insensitive wildcard on server
            // without SCAN and filtering. For now, since we fetch keys then filter?
            // Wait, the previous impl used KEYS *search*.
            // If we want FULL consistency, we should fetch more and filter in Rust, or accept case-sensitivity.
            // Given it's Redis, KEYS is dangerous in prod anyway, but this is a desktop app connection.
            // Let's stick to simple *pattern* for now, but if the user types lowercase 'user', and key is 'User', KEYS *user* won't find it.
            // Better approach for consistency: Scan/Keys * then filter in Rust.
            
            let mut keys: Vec<String> = redis::cmd("KEYS")
                .arg("*") // Fetch all, then filter. Safe for small/desktop apps.
                .query_async(&mut conn)
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            if let Some(s) = search {
                let s_lower = s.to_lowercase();
                keys.retain(|k| k.to_lowercase().contains(&s_lower));
            }

            keys.sort();

            let start = offset.unwrap_or(0) as usize;
            let end = if let Some(l) = limit {
                std::cmp::min(start + l as usize, keys.len())
            } else {
                keys.len()
            };

            if start >= keys.len() {
                Ok(vec![])
            } else {
                Ok(keys[start..end].to_vec())
            }
        }
        DatabasePool::MongoDB(mongo_pool) => {
            let db = mongo_pool.client.database(&mongo_pool.database);
            let mut collections = db
                .list_collection_names()
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;
            
            if let Some(s) = search {
                 let s_lower = s.to_lowercase();
                 collections.retain(|c| c.to_lowercase().contains(&s_lower));
            }

            collections.sort();
            
            let start = offset.unwrap_or(0) as usize;
            let end = if let Some(l) = limit {
                std::cmp::min(start + l as usize, collections.len())
            } else {
                collections.len()
            };
            
            if start >= collections.len() {
                Ok(vec![])
            } else {
                Ok(collections[start..end].to_vec())
            }
        }
    }
}

pub async fn list_views(pool: &DatabasePool) -> Result<Vec<String>, VelocityError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            let rows: Vec<(String,)> = sqlx::query_as(
                "SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname",
            )
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::MySQL(pool) => {
            let rows: Vec<(String,)> = sqlx::query_as(
                "SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
            ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::SQLite(pool) => {
            let rows: Vec<(String,)> = sqlx::query_as(
                "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name",
            )
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        _ => Ok(vec![]),
    }
}

pub async fn list_functions(pool: &DatabasePool) -> Result<Vec<String>, VelocityError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            let rows: Vec<(String,)> = sqlx::query_as(
                "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name"
            ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        DatabasePool::MySQL(pool) => {
            let rows: Vec<(String,)> = sqlx::query_as(
                "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() ORDER BY ROUTINE_NAME"
            ).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;
            Ok(rows.into_iter().map(|r| r.0).collect())
        }
        _ => Ok(vec![]),
    }
}

pub async fn get_table_foreign_keys(
    pool: &DatabasePool,
    table_name: &str,
) -> Result<Vec<ForeignKeyInfo>, VelocityError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            let rows: Vec<(String, String, String, String)> = sqlx::query_as(
                r#"SELECT
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS referenced_table,
                    ccu.column_name AS referenced_column
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_name = $1
                    AND tc.table_schema = 'public'
                ORDER BY tc.constraint_name"#,
            )
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(
                    |(constraint_name, column_name, referenced_table, referenced_column)| {
                        ForeignKeyInfo {
                            constraint_name,
                            column_name,
                            referenced_table,
                            referenced_column,
                        }
                    },
                )
                .collect())
        }
        DatabasePool::MySQL(pool) => {
            let rows: Vec<(String, String, String, String)> = sqlx::query_as(
                r#"SELECT
                    CONSTRAINT_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_NAME = ?
                    AND REFERENCED_TABLE_NAME IS NOT NULL
                    AND TABLE_SCHEMA = DATABASE()
                ORDER BY CONSTRAINT_NAME"#,
            )
            .bind(table_name)
            .fetch_all(pool)
            .await
            .map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(
                    |(constraint_name, column_name, referenced_table, referenced_column)| {
                        ForeignKeyInfo {
                            constraint_name,
                            column_name,
                            referenced_table,
                            referenced_column,
                        }
                    },
                )
                .collect())
        }
        DatabasePool::SQLite(pool) => {
            let rows: Vec<(i32, i32, String, String, String, String, String, String)> =
                sqlx::query_as(&format!("PRAGMA foreign_key_list('{}')", table_name))
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(|(id, _, table, from, to, _, _, _)| ForeignKeyInfo {
                    constraint_name: format!("fk_{}", id),
                    column_name: from,
                    referenced_table: table,
                    referenced_column: to,
                })
                .collect())
        }
        _ => Ok(vec![]),
    }
}

pub async fn get_table_schema(
    pool: &DatabasePool,
    table_name: &str,
) -> Result<Vec<ColumnInfo>, VelocityError> {
    match pool {
        DatabasePool::Postgres(pool) => {
            let rows: Vec<(String, String, String, Option<i32>)> = sqlx::query_as(
                r#"SELECT column_name, data_type, CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END, character_maximum_length
                FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position"#
            ).bind(table_name).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(|(name, data_type, nullable, max_length)| ColumnInfo {
                    name,
                    data_type,
                    nullable: nullable == "YES",
                    max_length,
                    is_primary_key: false,
                })
                .collect())
        }
        DatabasePool::MySQL(pool) => {
            let rows: Vec<(String, String, String, Option<i64>)> = sqlx::query_as(
                r#"SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION"#
            ).bind(table_name).fetch_all(pool).await.map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(|(name, data_type, nullable, max_length)| ColumnInfo {
                    name,
                    data_type,
                    nullable: nullable == "YES",
                    max_length: max_length.map(|l| l as i32),
                    is_primary_key: false,
                    })
                .collect())
        }
        DatabasePool::SQLite(pool) => {
            let rows: Vec<(i32, String, String, i32, Option<String>, i32)> =
                sqlx::query_as(&format!("PRAGMA table_info({})", table_name))
                    .fetch_all(pool)
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;

            Ok(rows
                .into_iter()
                .map(|(_, name, data_type, notnull, _, pk)| ColumnInfo {
                    name,
                    data_type,
                    nullable: notnull == 0,
                    max_length: None,
                    is_primary_key: pk == 1,
                })
                .collect())
        }
        DatabasePool::SQLServer(_) => Ok(vec![]),
        DatabasePool::Redis(_) => Ok(vec![ColumnInfo {
            name: "value".into(),
            data_type: "string".into(),
            nullable: true,
            max_length: None,
            is_primary_key: false,
        }]),
        DatabasePool::MongoDB(_) => {
            // MongoDB is schemaless - return _id as the only fixed column
            // Real columns will be inferred from documents at query time
            Ok(vec![ColumnInfo {
                name: "_id".into(),
                data_type: "ObjectId".into(),
                nullable: false,
                max_length: None,
                is_primary_key: true,
            }])
        }
    }
}
