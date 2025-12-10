use crate::error::VelocityError;
use crate::commands::database::{ExecuteResult, PendingChange};
use super::enums::DatabasePool;
use super::utils::{format_value_for_sql, format_pk_for_sql};
use sqlx::{Connection, ConnectOptions};

pub async fn execute_changes(
    pool: &DatabasePool,
    table_name: &str,
    primary_key_column: &str,
    changes: Vec<PendingChange>,
) -> Result<ExecuteResult, VelocityError> {
    let mut rows_affected: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    match pool {
        DatabasePool::Postgres(pool) => {
            // Start transaction
            let mut tx = pool
                .begin()
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            for change in changes {
                let result = match change.change_type.as_str() {
                    "update" => {
                        // Use raw SQL with properly formatted value to preserve types
                        let formatted_value = format_value_for_sql(&change.new_value);
                        let sql = format!(
                            "UPDATE \"{}\" SET \"{}\" = {} WHERE \"{}\" = {}",
                            table_name,
                            change.column,
                            formatted_value,
                            primary_key_column,
                            format_pk_for_sql(&change.row_id)
                        );
                        sqlx::query(&sql).execute(&mut *tx).await
                    }
                    "delete" => {
                        let sql = format!(
                            "DELETE FROM \"{}\" WHERE \"{}\" = {}",
                            table_name,
                            primary_key_column,
                            format_pk_for_sql(&change.row_id)
                        );
                        sqlx::query(&sql).execute(&mut *tx).await
                    }
                    "insert" => {
                        let formatted_value = format_value_for_sql(&change.new_value);
                        let sql = format!(
                            "INSERT INTO \"{}\" (\"{}\") VALUES ({})",
                            table_name, change.column, formatted_value
                        );
                        sqlx::query(&sql).execute(&mut *tx).await
                    }
                    _ => continue,
                };

                match result {
                    Ok(r) => rows_affected += r.rows_affected() as i64,
                    Err(e) => errors.push(format!("{}: {}", change.change_type, e)),
                }
            }

            if errors.is_empty() {
                tx.commit()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
            } else {
                tx.rollback()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
            }
        }
        DatabasePool::MySQL(pool) => {
            let mut tx = pool
                .begin()
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            for change in changes {
                let result = match change.change_type.as_str() {
                    "update" => {
                        let formatted_value = format_value_for_sql(&change.new_value);
                        let sql = format!(
                            "UPDATE `{}` SET `{}` = {} WHERE `{}` = {}",
                            table_name,
                            change.column,
                            formatted_value,
                            primary_key_column,
                            format_pk_for_sql(&change.row_id)
                        );
                        sqlx::query(&sql).execute(&mut *tx).await
                    }
                    "delete" => {
                        let sql = format!(
                            "DELETE FROM `{}` WHERE `{}` = {}",
                            table_name,
                            primary_key_column,
                            format_pk_for_sql(&change.row_id)
                        );
                        sqlx::query(&sql).execute(&mut *tx).await
                    }
                    _ => continue,
                };

                match result {
                    Ok(r) => rows_affected += r.rows_affected() as i64,
                    Err(e) => errors.push(format!("{}: {}", change.change_type, e)),
                }
            }

            if errors.is_empty() {
                tx.commit()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
            } else {
                tx.rollback()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
            }
        }
        DatabasePool::SQLite(pool) => {
            let mut tx = pool
                .begin()
                .await
                .map_err(|e| VelocityError::Query(e.to_string()))?;

            for change in changes {
                let result = match change.change_type.as_str() {
                    "update" => {
                        let formatted_value = format_value_for_sql(&change.new_value);
                        let sql = format!(
                            "UPDATE \"{}\" SET \"{}\" = {} WHERE \"{}\" = {}",
                            table_name,
                            change.column,
                            formatted_value,
                            primary_key_column,
                            format_pk_for_sql(&change.row_id)
                        );
                        sqlx::query(&sql).execute(&mut *tx).await
                    }
                    "delete" => {
                        let sql = format!(
                            "DELETE FROM \"{}\" WHERE \"{}\" = {}",
                            table_name,
                            primary_key_column,
                            format_pk_for_sql(&change.row_id)
                        );
                        sqlx::query(&sql).execute(&mut *tx).await
                    }
                    _ => continue,
                };

                match result {
                    Ok(r) => rows_affected += r.rows_affected() as i64,
                    Err(e) => errors.push(format!("{}: {}", change.change_type, e)),
                }
            }

            if errors.is_empty() {
                tx.commit()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
            } else {
                tx.rollback()
                    .await
                    .map_err(|e| VelocityError::Query(e.to_string()))?;
            }
        }
        _ => {
            return Err(VelocityError::Query(
                "Execute changes not supported for this database type".to_string(),
            ));
        }
    }

    Ok(ExecuteResult {
        success: errors.is_empty(),
        rows_affected,
        errors,
    })
}
