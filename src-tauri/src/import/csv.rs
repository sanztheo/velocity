use std::fs::File;
use std::path::Path;
use crate::error::VelocityError;
use super::{CsvPreview, ColumnMapping};

/// Preview CSV file for column mapping
pub fn preview_csv<P: AsRef<Path>>(
    path: P,
    preview_rows: usize,
) -> Result<CsvPreview, VelocityError> {
    let file = File::open(path.as_ref())
        .map_err(|e| VelocityError::Import(format!("Failed to open file: {}", e)))?;

    // Try to detect delimiter
    let delimiter = detect_delimiter(path.as_ref())?;

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter as u8)
        .from_reader(file);

    let headers: Vec<String> = reader.headers()
        .map_err(|e| VelocityError::Import(format!("Failed to read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let mut rows = Vec::new();
    let mut total_count = 0;

    for result in reader.records() {
        total_count += 1;
        if rows.len() < preview_rows {
            let record = result
                .map_err(|e| VelocityError::Import(format!("Failed to read row: {}", e)))?;
            rows.push(record.iter().map(|s| s.to_string()).collect());
        }
    }

    Ok(CsvPreview {
        headers,
        rows,
        total_rows: total_count,
        detected_delimiter: delimiter,
    })
}

fn detect_delimiter<P: AsRef<Path>>(path: P) -> Result<char, VelocityError> {
    let content = std::fs::read_to_string(path.as_ref())
        .map_err(|e| VelocityError::Import(format!("Failed to read file: {}", e)))?;

    let first_line = content.lines().next().unwrap_or("");
    
    // Count occurrences of common delimiters
    let comma_count = first_line.matches(',').count();
    let semicolon_count = first_line.matches(';').count();
    let tab_count = first_line.matches('\t').count();
    let pipe_count = first_line.matches('|').count();

    if semicolon_count > comma_count && semicolon_count >= tab_count && semicolon_count >= pipe_count {
        Ok(';')
    } else if tab_count > comma_count && tab_count >= semicolon_count && tab_count >= pipe_count {
        Ok('\t')
    } else if pipe_count > comma_count && pipe_count >= semicolon_count && pipe_count >= tab_count {
        Ok('|')
    } else {
        Ok(',')
    }
}

/// Parse CSV with column mapping and return rows as JSON values
pub fn parse_csv_with_mapping<P: AsRef<Path>>(
    path: P,
    mappings: &[ColumnMapping],
    delimiter: char,
) -> Result<Vec<serde_json::Value>, VelocityError> {
    let file = File::open(path.as_ref())
        .map_err(|e| VelocityError::Import(format!("Failed to open file: {}", e)))?;

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter as u8)
        .from_reader(file);

    let headers: Vec<String> = reader.headers()
        .map_err(|e| VelocityError::Import(format!("Failed to read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    // Build mapping index
    let mapping_indices: Vec<(usize, &ColumnMapping)> = mappings
        .iter()
        .filter_map(|m| {
            headers.iter().position(|h| h == &m.csv_column).map(|idx| (idx, m))
        })
        .collect();

    let mut rows = Vec::new();

    for result in reader.records() {
        let record = result
            .map_err(|e| VelocityError::Import(format!("Failed to read row: {}", e)))?;
        
        let mut obj = serde_json::Map::new();
        for (csv_idx, mapping) in &mapping_indices {
            let value = record.get(*csv_idx).unwrap_or("");
            obj.insert(mapping.table_column.clone(), serde_json::Value::String(value.to_string()));
        }
        rows.push(serde_json::Value::Object(obj));
    }

    Ok(rows)
}
