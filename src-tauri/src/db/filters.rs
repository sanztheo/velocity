//! Filter types and SQL query building for table data
//!
//! This module handles filter operations, sort configuration, and safe SQL generation.

use serde::{Deserialize, Serialize};

/// Available filter operators
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FilterOperator {
    /// Exact match: column = value
    Equals,
    /// Not equal: column != value
    NotEquals,
    /// Pattern match: column LIKE '%value%'
    Like,
    /// Null check: column IS NULL
    IsNull,
    /// Not null check: column IS NOT NULL
    IsNotNull,
    /// List match: column IN (value1, value2, ...)
    In,
    /// Greater than: column > value
    GreaterThan,
    /// Less than: column < value
    LessThan,
}

/// A single column filter
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnFilter {
    pub column: String,
    pub operator: FilterOperator,
    pub value: Option<serde_json::Value>,
}

/// Sort direction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortDirection {
    Asc,
    Desc,
}

/// Sort configuration for a column
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortConfig {
    pub column: String,
    pub direction: SortDirection,
}

/// Logic for combining multiple filters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum FilterLogic {
    #[default]
    And,
    Or,
}

/// Complete query options for table data fetching
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueryOptions {
    #[serde(default)]
    pub filters: Vec<ColumnFilter>,
    #[serde(default)]
    pub filter_logic: FilterLogic,
    pub sort: Option<SortConfig>,
    #[serde(default = "default_limit")]
    pub limit: i32,
    #[serde(default)]
    pub offset: i32,
}

fn default_limit() -> i32 {
    100
}

impl QueryOptions {
    /// Build a WHERE clause from filters (returns empty string if no filters)
    /// Uses parameterized values to prevent SQL injection
    pub fn build_where_clause(&self) -> (String, Vec<String>) {
        if self.filters.is_empty() {
            return (String::new(), Vec::new());
        }

        let mut conditions = Vec::new();
        let mut params = Vec::new();

        for filter in &self.filters {
            let condition = match filter.operator {
                FilterOperator::Equals => {
                    if let Some(val) = &filter.value {
                        params.push(json_to_sql_value(val));
                        format!("\"{}\" = ${}", filter.column, params.len())
                    } else {
                        continue;
                    }
                }
                FilterOperator::NotEquals => {
                    if let Some(val) = &filter.value {
                        params.push(json_to_sql_value(val));
                        format!("\"{}\" != ${}", filter.column, params.len())
                    } else {
                        continue;
                    }
                }
                FilterOperator::Like => {
                    if let Some(val) = &filter.value {
                        let search_val = format!("%{}%", val.as_str().unwrap_or(""));
                        params.push(search_val);
                        format!("\"{}\" ILIKE ${}", filter.column, params.len())
                    } else {
                        continue;
                    }
                }
                FilterOperator::IsNull => {
                    format!("\"{}\" IS NULL", filter.column)
                }
                FilterOperator::IsNotNull => {
                    format!("\"{}\" IS NOT NULL", filter.column)
                }
                FilterOperator::In => {
                    if let Some(serde_json::Value::Array(arr)) = &filter.value {
                        if arr.is_empty() {
                            continue;
                        }
                        let placeholders: Vec<String> = arr
                            .iter()
                            .map(|v| {
                                params.push(json_to_sql_value(v));
                                format!("${}", params.len())
                            })
                            .collect();
                        format!("\"{}\" IN ({})", filter.column, placeholders.join(", "))
                    } else {
                        continue;
                    }
                }
                FilterOperator::GreaterThan => {
                    if let Some(val) = &filter.value {
                        params.push(json_to_sql_value(val));
                        format!("\"{}\" > ${}", filter.column, params.len())
                    } else {
                        continue;
                    }
                }
                FilterOperator::LessThan => {
                    if let Some(val) = &filter.value {
                        params.push(json_to_sql_value(val));
                        format!("\"{}\" < ${}", filter.column, params.len())
                    } else {
                        continue;
                    }
                }
            };
            conditions.push(condition);
        }

        if conditions.is_empty() {
            return (String::new(), Vec::new());
        }

        let joiner = match self.filter_logic {
            FilterLogic::And => " AND ",
            FilterLogic::Or => " OR ",
        };

        let where_clause = format!(" WHERE {}", conditions.join(joiner));
        (where_clause, params)
    }

    /// Build ORDER BY clause
    pub fn build_order_clause(&self) -> String {
        match &self.sort {
            Some(sort) => {
                let direction = match sort.direction {
                    SortDirection::Asc => "ASC",
                    SortDirection::Desc => "DESC",
                };
                format!(" ORDER BY \"{}\" {}", sort.column, direction)
            }
            None => String::new(),
        }
    }

    /// Build LIMIT OFFSET clause
    pub fn build_pagination_clause(&self) -> String {
        format!(" LIMIT {} OFFSET {}", self.limit, self.offset)
    }
}

/// Convert JSON value to SQL-safe string
fn json_to_sql_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        _ => value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_filters() {
        let options = QueryOptions::default();
        let (clause, params) = options.build_where_clause();
        assert_eq!(clause, "");
        assert!(params.is_empty());
    }

    #[test]
    fn test_equals_filter() {
        let options = QueryOptions {
            filters: vec![ColumnFilter {
                column: "name".to_string(),
                operator: FilterOperator::Equals,
                value: Some(serde_json::json!("test")),
            }],
            ..Default::default()
        };
        let (clause, params) = options.build_where_clause();
        assert_eq!(clause, " WHERE \"name\" = $1");
        assert_eq!(params, vec!["test"]);
    }

    #[test]
    fn test_sort_clause() {
        let options = QueryOptions {
            sort: Some(SortConfig {
                column: "created_at".to_string(),
                direction: SortDirection::Desc,
            }),
            ..Default::default()
        };
        assert_eq!(
            options.build_order_clause(),
            " ORDER BY \"created_at\" DESC"
        );
    }
}
