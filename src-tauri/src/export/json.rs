use std::fs::File;
use std::io::Write;
use std::path::Path;
use crate::error::VelocityError;

/// Export data rows to JSON format
pub fn export_to_json<P: AsRef<Path>>(
    path: P,
    headers: &[String],
    rows: &[Vec<serde_json::Value>],
    pretty: bool,
) -> Result<usize, VelocityError> {
    let mut file = File::create(path.as_ref())
        .map_err(|e| VelocityError::Export(format!("Failed to create file: {}", e)))?;

    // Convert rows to array of objects
    let json_rows: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let mut obj = serde_json::Map::new();
            for (i, header) in headers.iter().enumerate() {
                let value = row.get(i).cloned().unwrap_or(serde_json::Value::Null);
                obj.insert(header.clone(), value);
            }
            serde_json::Value::Object(obj)
        })
        .collect();

    let json_string = if pretty {
        serde_json::to_string_pretty(&json_rows)
    } else {
        serde_json::to_string(&json_rows)
    }
    .map_err(|e| VelocityError::Export(format!("Failed to serialize JSON: {}", e)))?;

    file.write_all(json_string.as_bytes())
        .map_err(|e| VelocityError::Export(format!("Failed to write JSON: {}", e)))?;

    Ok(rows.len())
}
