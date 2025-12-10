use std::path::Path;
use rust_xlsxwriter::{Workbook, Format};
use crate::error::VelocityError;

/// Export data rows to Excel format
pub fn export_to_excel<P: AsRef<Path>>(
    path: P,
    headers: &[String],
    rows: &[Vec<serde_json::Value>],
    sheet_name: Option<&str>,
) -> Result<usize, VelocityError> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    
    if let Some(name) = sheet_name {
        worksheet.set_name(name)
            .map_err(|e| VelocityError::Export(format!("Failed to set sheet name: {}", e)))?;
    }

    let header_format = Format::new().set_bold();

    // Write headers
    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, header, &header_format)
            .map_err(|e| VelocityError::Export(format!("Failed to write header: {}", e)))?;
    }

    // Write data rows
    for (row_idx, row) in rows.iter().enumerate() {
        for (col_idx, value) in row.iter().enumerate() {
            let row_num = (row_idx + 1) as u32;
            let col_num = col_idx as u16;
            
            match value {
                serde_json::Value::Null => {
                    worksheet.write_string(row_num, col_num, "")
                        .map_err(|e| VelocityError::Export(format!("Write error: {}", e)))?;
                }
                serde_json::Value::Bool(b) => {
                    worksheet.write_boolean(row_num, col_num, *b)
                        .map_err(|e| VelocityError::Export(format!("Write error: {}", e)))?;
                }
                serde_json::Value::Number(n) => {
                    if let Some(f) = n.as_f64() {
                        worksheet.write_number(row_num, col_num, f)
                            .map_err(|e| VelocityError::Export(format!("Write error: {}", e)))?;
                    } else {
                        worksheet.write_string(row_num, col_num, &n.to_string())
                            .map_err(|e| VelocityError::Export(format!("Write error: {}", e)))?;
                    }
                }
                serde_json::Value::String(s) => {
                    worksheet.write_string(row_num, col_num, s)
                        .map_err(|e| VelocityError::Export(format!("Write error: {}", e)))?;
                }
                _ => {
                    worksheet.write_string(row_num, col_num, &value.to_string())
                        .map_err(|e| VelocityError::Export(format!("Write error: {}", e)))?;
                }
            }
        }
    }

    for col in 0..headers.len() {
        worksheet.set_column_width(col as u16, 15)
            .map_err(|e| VelocityError::Export(format!("Column width error: {}", e)))?;
    }

    workbook.save(path.as_ref())
        .map_err(|e| VelocityError::Export(format!("Failed to save Excel: {}", e)))?;

    Ok(rows.len())
}
