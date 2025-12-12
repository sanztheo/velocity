use crate::db::table_data::fetch_table_data;
use crate::db::{ColumnInfo, ConnectionPoolManager, QueryOptions, TableData, TableDataResponse};
use crate::error::VelocityError;
use crate::models::connection::Connection;
use crate::store::connections::ConnectionsStore;
use std::sync::Arc;
use tauri::State;

/// Test a database connection
#[tauri::command]
pub async fn test_connection(conn: Connection) -> Result<String, VelocityError> {
    ConnectionPoolManager::test_connection(&conn).await?;
    Ok("Connection successful!".to_string())
}

/// Connect to a database
#[tauri::command]
pub async fn connect(
    id: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
    store: State<'_, ConnectionsStore>,
) -> Result<(), VelocityError> {
    let connections = store.load()?;
    let connection = connections
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| VelocityError::NotFound("Connection not found".to_string()))?;

    pool_manager.connect(&connection).await
}

/// Disconnect from a database
#[tauri::command]
pub async fn disconnect(
    id: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<(), VelocityError> {
    pool_manager.disconnect(&id).await
}

/// Check if connected
#[tauri::command]
pub async fn is_connected(
    id: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<bool, VelocityError> {
    Ok(pool_manager.is_connected(&id).await)
}

/// List databases for a connection
#[tauri::command]
pub async fn list_databases(
    id: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<String>, VelocityError> {
    pool_manager.list_databases(&id).await
}

/// List tables for a connection
#[tauri::command]
pub async fn list_tables(
    id: String,
    limit: Option<u32>,
    offset: Option<u32>,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<String>, VelocityError> {
    pool_manager.list_tables(&id, limit, offset).await
}

/// List views for a connection
#[tauri::command]
pub async fn list_views(
    id: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<String>, VelocityError> {
    pool_manager.list_views(&id).await
}

/// List functions for a connection
#[tauri::command]
pub async fn list_functions(
    id: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<String>, VelocityError> {
    pool_manager.list_functions(&id).await
}

/// Foreign key info structure
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyInfo {
    pub constraint_name: String,
    pub column_name: String,
    pub referenced_table: String,
    pub referenced_column: String,
}

/// Get table foreign keys
#[tauri::command]
pub async fn get_table_foreign_keys(
    connection_id: String,
    table_name: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<ForeignKeyInfo>, VelocityError> {
    pool_manager
        .get_table_foreign_keys(&connection_id, &table_name)
        .await
}

/// Get table schema (columns)
#[tauri::command]
pub async fn get_table_schema(
    connection_id: String,
    table_name: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<ColumnInfo>, VelocityError> {
    pool_manager
        .get_table_schema(&connection_id, &table_name)
        .await
}

/// Get table data with pagination
#[tauri::command]
pub async fn get_table_data(
    connection_id: String,
    table_name: String,
    limit: i32,
    offset: i32,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<TableData, VelocityError> {
    pool_manager
        .get_table_data(&connection_id, &table_name, limit, offset)
        .await
}

/// Get table data with filtering, sorting, and pagination
#[tauri::command]
pub async fn get_table_data_filtered(
    connection_id: String,
    table_name: String,
    options: QueryOptions,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<TableDataResponse, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    let columns = pool_manager
        .get_table_schema(&connection_id, &table_name)
        .await?;

    fetch_table_data(pool.as_ref(), &table_name, &columns, &options).await
}

/// A pending change to be executed
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingChange {
    pub row_id: String,
    pub column: String,
    pub old_value: serde_json::Value,
    pub new_value: serde_json::Value,
    #[serde(rename = "type")]
    pub change_type: String, // "update", "insert", "delete"
}

/// Result of executing changes
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResult {
    pub success: bool,
    pub rows_affected: i64,
    pub errors: Vec<String>,
}

/// Execute pending changes (INSERT, UPDATE, DELETE)
#[tauri::command]
pub async fn execute_changes(
    connection_id: String,
    table_name: String,
    changes: Vec<PendingChange>,
    primary_key_column: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<ExecuteResult, VelocityError> {
    pool_manager
        .execute_changes(&connection_id, &table_name, &primary_key_column, changes)
        .await
}

/// Query result for SQL editor
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResultData {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: i64,
}

/// Execute a raw SQL query
#[tauri::command]
pub async fn execute_query(
    connection_id: String,
    sql: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<QueryResultData, VelocityError> {
    pool_manager.execute_query(&connection_id, &sql).await
}

/// Get query execution plan (EXPLAIN)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplainResult {
    pub plan: Vec<String>,
}

#[tauri::command]
pub async fn explain_query(
    connection_id: String,
    sql: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<ExplainResult, VelocityError> {
    pool_manager.explain_query(&connection_id, &sql).await
}

// ============================================================================
// AI Agent Commands (LLM-friendly wrappers)
// ============================================================================

/// Safe query result for AI agent with detailed error information
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeQueryResult {
    pub success: bool,
    pub columns: Option<Vec<String>>,
    pub rows: Option<Vec<Vec<serde_json::Value>>>,
    pub row_count: Option<i64>,
    pub error_message: Option<String>,
    pub error_hint: Option<String>,
}

/// Execute SQL safely with LLM-friendly error messages
/// This command never errors at the Tauri level - it returns structured results including failures
#[tauri::command]
pub async fn execute_sql_safe(
    app_handle: tauri::AppHandle,
    connection_id: String,
    sql: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<SafeQueryResult, VelocityError> {
    use tauri::Emitter;

    let result = pool_manager.execute_query(&connection_id, &sql).await;
    
    // Check if we need to emit a schema change event (DDL / Mutations)
    if result.is_ok() {
        let sql_upper = sql.trim().to_uppercase();
        let is_schema_change = sql_upper.starts_with("CREATE") 
            || sql_upper.starts_with("DROP") 
            || sql_upper.starts_with("ALTER")
            || sql_upper.starts_with("TRUNCATE");
            
        if is_schema_change {
            let _ = app_handle.emit("database:schema-changed", &connection_id);
        }
    }

    Ok(match result {
        Ok(result) => SafeQueryResult {
            success: true,
            columns: Some(result.columns),
            rows: Some(result.rows),
            row_count: Some(result.row_count),
            error_message: None,
            error_hint: None,
        },
        Err(e) => {
            let error_str = e.to_string();
            let hint = generate_error_hint(&error_str, &sql);
            SafeQueryResult {
                success: false,
                columns: None,
                rows: None,
                row_count: None,
                error_message: Some(error_str),
                error_hint: hint,
            }
        }
    })
}

/// Generate helpful hints for common SQL errors
fn generate_error_hint(error: &str, sql: &str) -> Option<String> {
    let error_lower = error.to_lowercase();
    let sql_lower = sql.to_lowercase();
    
    if error_lower.contains("syntax error") {
        Some("Check SQL syntax. Common issues: missing quotes, typos in keywords, or incorrect clause order.".to_string())
    } else if error_lower.contains("relation") && error_lower.contains("does not exist") {
        Some("The table or view does not exist. Use get_database_schema to see available tables.".to_string())
    } else if error_lower.contains("column") && error_lower.contains("does not exist") {
        Some("Column not found. Use get_database_schema to check column names for this table.".to_string())
    } else if error_lower.contains("permission denied") {
        Some("Access denied. The user may not have permission for this operation.".to_string())
    } else if error_lower.contains("duplicate key") || error_lower.contains("unique constraint") {
        Some("Duplicate value violates a unique constraint. Try using different values or UPDATE instead.".to_string())
    } else if error_lower.contains("foreign key") {
        Some("Foreign key constraint violation. The referenced record must exist first.".to_string())
    } else if error_lower.contains("timeout") {
        if sql_lower.contains("select") && !sql_lower.contains("limit") {
            Some("Query timed out. Consider adding a LIMIT clause or optimizing the query.".to_string())
        } else {
            Some("Query timed out. The operation took too long to complete.".to_string())
        }
    } else {
        None
    }
}

/// Table schema information for AI context
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchemaInfo {
    pub name: String,
    pub columns: Vec<ColumnInfo>,
}

/// Full database schema for AI agent context
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseSchemaInfo {
    pub tables: Vec<TableSchemaInfo>,
    pub views: Vec<String>,
    pub functions: Vec<String>,
}

/// Get complete database schema for AI agent
#[tauri::command]
pub async fn get_database_schema_full(
    id: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<DatabaseSchemaInfo, VelocityError> {
    // Get all tables
    let table_names = pool_manager.list_tables(&id, None, None).await?;
    
    // Get schema for each table
    let mut tables = Vec::new();
    for table_name in table_names {
        match pool_manager.get_table_schema(&id, &table_name).await {
            Ok(columns) => {
                tables.push(TableSchemaInfo {
                    name: table_name,
                    columns,
                });
            }
            Err(_) => {
                // Skip tables we can't read schema for
                tables.push(TableSchemaInfo {
                    name: table_name,
                    columns: vec![],
                });
            }
        }
    }
    
    // Get views
    let views = pool_manager.list_views(&id).await.unwrap_or_default();
    
    // Get functions
    let functions = pool_manager.list_functions(&id).await.unwrap_or_default();
    
    Ok(DatabaseSchemaInfo {
        tables,
        views,
        functions,
    })
}

// ============================================================================
// Schema / DDL Commands
// ============================================================================

use crate::db::schema_ops::{
    self, ColumnDefinition, CreateTableRequest, ForeignKeyDefinition, IndexInfo,
};

/// Preview SQL for creating a table (returns SQL without executing)
#[tauri::command]
pub async fn preview_create_table(
    connection_id: String,
    request: CreateTableRequest,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_create_table_sql(pool.as_ref(), &request)
}

/// Execute a DDL statement
#[tauri::command]
pub async fn execute_ddl(
    app_handle: tauri::AppHandle,
    id: String,
    sql: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<(), VelocityError> {
    use tauri::Emitter;

    let pool = pool_manager
        .get_pool(&id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    let result = schema_ops::execute_ddl(pool.as_ref(), &sql).await;
    
    if result.is_ok() {
        let _ = app_handle.emit("database:schema-changed", &id);
    }
    
    result
}

/// Preview SQL for adding a column
#[tauri::command]
pub async fn preview_add_column(
    connection_id: String,
    table_name: String,
    column: ColumnDefinition,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_add_column_sql(pool.as_ref(), &table_name, &column)
}

/// Preview SQL for dropping a column
#[tauri::command]
pub async fn preview_drop_column(
    connection_id: String,
    table_name: String,
    column_name: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_drop_column_sql(pool.as_ref(), &table_name, &column_name)
}

/// Preview SQL for modifying a column
#[tauri::command]
pub async fn preview_modify_column(
    connection_id: String,
    table_name: String,
    old_column_name: String,
    new_column: ColumnDefinition,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_modify_column_sql(
        pool.as_ref(),
        &table_name,
        &old_column_name,
        &new_column,
    )
}

/// Preview SQL for creating an index
#[tauri::command]
pub async fn preview_create_index(
    connection_id: String,
    table_name: String,
    index: IndexInfo,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_create_index_sql(pool.as_ref(), &table_name, &index)
}

/// Preview SQL for dropping an index
#[tauri::command]
pub async fn preview_drop_index(
    connection_id: String,
    table_name: String,
    index_name: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_drop_index_sql(pool.as_ref(), &table_name, &index_name)
}

/// Preview SQL for adding a foreign key
#[tauri::command]
pub async fn preview_add_foreign_key(
    connection_id: String,
    table_name: String,
    fk: ForeignKeyDefinition,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_add_foreign_key_sql(pool.as_ref(), &table_name, &fk)
}

/// Preview SQL for dropping a constraint
#[tauri::command]
pub async fn preview_drop_constraint(
    connection_id: String,
    table_name: String,
    constraint_name: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<String, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::generate_drop_constraint_sql(pool.as_ref(), &table_name, &constraint_name)
}

/// Get indexes for a table
#[tauri::command]
pub async fn get_table_indexes(
    connection_id: String,
    table_name: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<IndexInfo>, VelocityError> {
    let pool = pool_manager
        .get_pool(&connection_id)
        .await
        .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;

    schema_ops::get_table_indexes(pool.as_ref(), &table_name).await
}
