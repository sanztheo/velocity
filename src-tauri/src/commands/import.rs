use tauri::command;
use crate::db::pool::ConnectionPoolManager;
use crate::error::VelocityError;
use crate::import::{CsvPreview, ColumnMapping, ImportResult};

#[command]
pub async fn import_csv_preview(
    file_path: String,
    preview_rows: Option<usize>,
) -> Result<CsvPreview, VelocityError> {
    let rows = preview_rows.unwrap_or(10);
    crate::import::csv::preview_csv(&file_path, rows)
}

#[command]
pub async fn import_csv(
    id: String,
    table_name: String,
    file_path: String,
    mappings: Vec<ColumnMapping>,
    delimiter: Option<char>,
    pool_manager: tauri::State<'_, ConnectionPoolManager>,
) -> Result<ImportResult, VelocityError> {
    let delim = delimiter.unwrap_or(',');
    let rows = crate::import::csv::parse_csv_with_mapping(&file_path, &mappings, delim)?;
    
    let mut inserted = 0;
    let mut errors = Vec::new();
    
    for row in &rows {
        if let serde_json::Value::Object(obj) = row {
            let columns: Vec<String> = obj.keys().cloned().collect();
            let values: Vec<String> = obj.values()
                .map(|v| match v {
                    serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
                    serde_json::Value::Null => "NULL".to_string(),
                    other => other.to_string(),
                })
                .collect();
            
            let sql = format!(
                "INSERT INTO {} ({}) VALUES ({})",
                table_name,
                columns.join(", "),
                values.join(", ")
            );
            
            match pool_manager.execute_query(&id, &sql).await {
                Ok(_) => inserted += 1,
                Err(e) => errors.push(e.to_string()),
            }
        }
    }
    
    Ok(ImportResult {
        success: errors.is_empty(),
        rows_imported: inserted,
        errors,
    })
}

#[command]
pub async fn import_sql(
    id: String,
    file_path: String,
    pool_manager: tauri::State<'_, ConnectionPoolManager>,
) -> Result<ImportResult, VelocityError> {
    let sql_content = crate::import::sql::read_sql_file(&file_path)?;
    let statements = crate::import::sql::split_sql_statements(&sql_content);
    
    let mut executed = 0;
    let mut errors = Vec::new();
    
    for stmt in &statements {
        match pool_manager.execute_query(&id, stmt).await {
            Ok(_) => executed += 1,
            Err(e) => errors.push(format!("Statement failed: {}", e)),
        }
    }
    
    Ok(ImportResult {
        success: errors.is_empty(),
        rows_imported: executed,
        errors,
    })
}
