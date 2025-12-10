use crate::error::VelocityError;
use std::fs::File;
use std::path::Path;

/// Export data rows to CSV format
pub fn export_to_csv<P: AsRef<Path>>(
    path: P,
    headers: &[String],
    rows: &[Vec<serde_json::Value>],
    delimiter: Option<char>,
) -> Result<usize, VelocityError> {
    let file = File::create(path.as_ref())
        .map_err(|e| VelocityError::Export(format!("Failed to create file: {}", e)))?;

    let delimiter = delimiter.unwrap_or(',') as u8;

    let mut writer = csv::WriterBuilder::new()
        .delimiter(delimiter)
        .from_writer(file);

    // Write headers
    writer
        .write_record(headers)
        .map_err(|e| VelocityError::Export(format!("Failed to write headers: {}", e)))?;

    // Write data rows
    for row in rows {
        let string_row: Vec<String> = row.iter().map(|v| value_to_string(v)).collect();
        writer
            .write_record(&string_row)
            .map_err(|e| VelocityError::Export(format!("Failed to write row: {}", e)))?;
    }

    writer
        .flush()
        .map_err(|e| VelocityError::Export(format!("Failed to flush CSV: {}", e)))?;

    Ok(rows.len())
}

fn value_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => String::new(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => serde_json::to_string(arr).unwrap_or_default(),
        serde_json::Value::Object(obj) => serde_json::to_string(obj).unwrap_or_default(),
    }
}
