use std::fs;
use std::path::Path;
use crate::error::VelocityError;

/// Read SQL file contents for execution
pub fn read_sql_file<P: AsRef<Path>>(path: P) -> Result<String, VelocityError> {
    fs::read_to_string(path.as_ref())
        .map_err(|e| VelocityError::Import(format!("Failed to read SQL file: {}", e)))
}

/// Split SQL file into individual statements
pub fn split_sql_statements(sql: &str) -> Vec<String> {
    sql.split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !s.starts_with("--"))
        .map(|s| format!("{};", s))
        .collect()
}
