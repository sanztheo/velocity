use tauri::command;
use std::path::PathBuf;
use std::sync::Arc;
use crate::db::pool::ConnectionPoolManager;
use crate::error::VelocityError;
use crate::export::{ExportFormat, ExportResult};
use crate::store::connections::ConnectionsStore;

#[command]
pub async fn export_table_data(
    id: String,
    table_name: String,
    format: ExportFormat,
    file_path: String,
    options: Option<serde_json::Value>,
    pool_manager: tauri::State<'_, Arc<ConnectionPoolManager>>,
) -> Result<ExportResult, VelocityError> {
    // Fetch table data using the manager's get_table_data method
    let data = pool_manager.get_table_data(&id, &table_name, 10000, 0).await?;
    
    let headers: Vec<String> = data.columns.clone();
    let rows: Vec<Vec<serde_json::Value>> = data.rows;
    
    let path = PathBuf::from(&file_path);
    
    let rows_exported = match format {
        ExportFormat::Csv => {
            let delimiter = options
                .as_ref()
                .and_then(|o| o.get("delimiter"))
                .and_then(|d| d.as_str())
                .and_then(|s| s.chars().next());
            crate::export::csv::export_to_csv(&path, &headers, &rows, delimiter)?
        }
        ExportFormat::Json => {
            let pretty = options
                .as_ref()
                .and_then(|o| o.get("pretty"))
                .and_then(|p| p.as_bool())
                .unwrap_or(true);
            crate::export::json::export_to_json(&path, &headers, &rows, pretty)?
        }
        ExportFormat::Excel => {
            let sheet_name = options
                .as_ref()
                .and_then(|o| o.get("sheet_name"))
                .and_then(|s| s.as_str());
            crate::export::excel::export_to_excel(&path, &headers, &rows, sheet_name)?
        }
        ExportFormat::SqlDump => {
            return Err(VelocityError::Export("Use export_sql_dump for full database export".to_string()));
        }
    };
    
    Ok(ExportResult {
        success: true,
        file_path,
        rows_exported,
        message: Some(format!("Exported {} rows", rows_exported)),
    })
}

#[command]
pub async fn export_sql_dump(
    id: String,
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<ExportResult, VelocityError> {
    let store = ConnectionsStore::new(&app_handle)?;
    let connections = store.load()?;
    let connection = connections.into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| VelocityError::NotFound(format!("Connection {} not found", id)))?;
    
    let path = PathBuf::from(&file_path);
    let result_path = crate::export::sql_dump::export_sql_dump(&path, &connection)?;
    
    Ok(ExportResult {
        success: true,
        file_path: result_path,
        rows_exported: 0,
        message: Some("Database dump completed".to_string()),
    })
}
