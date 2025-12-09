use tauri::State;
use std::sync::Arc;
use crate::db::{ConnectionPoolManager, ColumnInfo, TableData};
use crate::error::VelocityError;
use crate::models::connection::Connection;
use crate::store::connections::ConnectionsStore;

/// Test a database connection
#[tauri::command]
pub async fn test_connection(
    conn: Connection,
) -> Result<String, VelocityError> {
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
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<String>, VelocityError> {
    pool_manager.list_tables(&id).await
}

/// Get table schema (columns)
#[tauri::command]
pub async fn get_table_schema(
    connection_id: String,
    table_name: String,
    pool_manager: State<'_, Arc<ConnectionPoolManager>>,
) -> Result<Vec<ColumnInfo>, VelocityError> {
    pool_manager.get_table_schema(&connection_id, &table_name).await
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
    pool_manager.get_table_data(&connection_id, &table_name, limit, offset).await
}

