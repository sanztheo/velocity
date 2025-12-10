/// Format a JSON value for use directly in SQL (preserves type)
pub fn format_value_for_sql(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => {
            // Escape single quotes for SQL
            let escaped = s.replace('\'', "''");
            format!("'{}'", escaped)
        }
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            // JSON types - escape and quote
            let json_str = value.to_string().replace('\'', "''");
            format!("'{}'", json_str)
        }
    }
}

/// Format a primary key value for use in SQL WHERE clause
pub fn format_pk_for_sql(pk: &str) -> String {
    // Try to parse as number first
    if pk.parse::<i64>().is_ok() || pk.parse::<f64>().is_ok() {
        pk.to_string()
    } else {
        // It's a string (like UUID) - escape and quote
        let escaped = pk.replace('\'', "''");
        format!("'{}'", escaped)
    }
}
