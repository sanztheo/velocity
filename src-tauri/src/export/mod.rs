pub mod csv;
pub mod excel;
pub mod json;
pub mod sql_dump;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    pub format: ExportFormat,
    pub file_path: PathBuf,
    pub include_headers: bool,
    pub delimiter: Option<char>,
    pub pretty_print: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Excel,
    SqlDump,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,
    pub file_path: String,
    pub rows_exported: usize,
    pub message: Option<String>,
}
