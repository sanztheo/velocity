//! AI-powered SQL completion using OpenAI API

use crate::error::VelocityError;

/// Request for AI SQL completion
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCompletionRequest {
    pub partial_sql: String,
    pub table_context: Vec<String>,
    pub column_context: Vec<String>,
    pub db_type: String,
}

/// Response from AI SQL completion
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCompletionResponse {
    pub suggestions: Vec<String>,
}

/// AI API Keys response (without exposing actual keys to logs)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiApiKeysStatus {
    pub grok_available: bool,
    pub openai_available: bool,
    pub gemini_available: bool,
}

/// Get SQL completion suggestions using OpenAI API
#[tauri::command]
pub async fn ai_sql_complete(
    request: AiCompletionRequest,
) -> Result<AiCompletionResponse, VelocityError> {
    let api_key = std::env::var("OPENAI_API_KEY").map_err(|_| {
        VelocityError::Query("OPENAI_API_KEY not set. Add it to your environment.".to_string())
    })?;

    let client = reqwest::Client::new();

    let system_prompt = format!(
        "You are a SQL assistant for {}. Given partial SQL and context, suggest 3-5 SQL completions. \
        Available tables: {}. Available columns: {}. \
        You MUST respond with a JSON object with a 'suggestions' key containing an array of SQL strings.",
        request.db_type,
        request.table_context.join(", "),
        request.column_context.join(", ")
    );

    let user_prompt = format!("Complete this SQL: {}", request.partial_sql);

    let payload = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": { "type": "json_object" },
        "temperature": 0.3,
        "max_tokens": 300
    });

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| VelocityError::Query(format!("OpenAI API error: {}", e)))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(VelocityError::Query(format!(
            "OpenAI error: {}",
            error_text
        )));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| VelocityError::Query(format!("Failed to parse response: {}", e)))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("{}");

    // Parse the JSON object with suggestions key
    let parsed: serde_json::Value = serde_json::from_str(content).unwrap_or(serde_json::json!({}));
    let suggestions: Vec<String> = parsed["suggestions"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(AiCompletionResponse { suggestions })
}

/// Check which AI API keys are available from environment variables
/// Returns availability status without exposing the actual keys
#[tauri::command]
pub async fn get_ai_api_keys_status() -> Result<AiApiKeysStatus, VelocityError> {
    Ok(AiApiKeysStatus {
        grok_available: std::env::var("GROK_API_KEY").is_ok(),
        openai_available: std::env::var("OPENAI_API_KEY").is_ok(),
        gemini_available: std::env::var("GEMINI_API_KEY").is_ok(),
    })
}

/// Get a specific AI API key from environment variables
/// This is called by the frontend to pass to AI SDK
#[tauri::command]
pub async fn get_ai_api_key(provider: String) -> Result<Option<String>, VelocityError> {
    let key = match provider.as_str() {
        "grok" => std::env::var("GROK_API_KEY").ok(),
        "openai" => std::env::var("OPENAI_API_KEY").ok(),
        "gemini" => std::env::var("GEMINI_API_KEY").ok(),
        _ => None,
    };
    Ok(key)
}

// ============================================================================
// AI Chat Streaming
// ============================================================================

/// A single message in the chat conversation
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Request for AI chat streaming
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub provider: Option<String>, // "grok", "openai", "gemini"
    pub system_prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

/// Chunk types emitted during streaming
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiChatChunk {
    /// Text content delta
    TextDelta { text: String },
    /// Tool call request from the model
    ToolCall {
        id: String,
        name: String,
        arguments: String,
    },
    /// Reasoning/thinking content
    Reasoning { text: String },
    /// Stream completed
    Done { finish_reason: Option<String> },
    /// Error occurred
    Error { message: String },
}

/// Stream AI chat responses from OpenAI/Grok/Gemini
#[tauri::command]
pub async fn ai_chat_stream(
    request: AiChatRequest,
    on_event: tauri::ipc::Channel<AiChatChunk>,
) -> Result<(), VelocityError> {
    use futures_util::StreamExt;
    
    // Determine provider and get API key
    let provider = request.provider.as_deref().unwrap_or("grok");
    let (api_key, api_url, model) = match provider {
        "grok" => {
            let key = std::env::var("GROK_API_KEY").map_err(|_| {
                VelocityError::Query("GROK_API_KEY not set".to_string())
            })?;
            (key, "https://api.x.ai/v1/chat/completions", request.model.unwrap_or_else(|| "grok-3-mini-fast".to_string()))
        }
        "openai" => {
            let key = std::env::var("OPENAI_API_KEY").map_err(|_| {
                VelocityError::Query("OPENAI_API_KEY not set".to_string())
            })?;
            (key, "https://api.openai.com/v1/chat/completions", request.model.unwrap_or_else(|| "gpt-4o-mini".to_string()))
        }
        "gemini" => {
            let key = std::env::var("GEMINI_API_KEY").map_err(|_| {
                VelocityError::Query("GEMINI_API_KEY not set".to_string())
            })?;
            // Gemini uses a different endpoint format
            let model = request.model.unwrap_or_else(|| "gemini-2.0-flash".to_string());
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
                model, key
            );
            (key, url.leak() as &'static str, model)
        }
        _ => {
            return Err(VelocityError::Query(format!("Unknown provider: {}", provider)));
        }
    };

    // Build messages array
    let mut api_messages: Vec<serde_json::Value> = Vec::new();
    
    // Add system prompt if provided
    if let Some(system) = &request.system_prompt {
        api_messages.push(serde_json::json!({
            "role": "system",
            "content": system
        }));
    }
    
    // Add conversation messages
    for msg in &request.messages {
        api_messages.push(serde_json::json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    // Build request payload (OpenAI/Grok format)
    let payload = if provider == "gemini" {
        // Gemini format
        serde_json::json!({
            "contents": request.messages.iter().map(|m| {
                serde_json::json!({
                    "role": if m.role == "assistant" { "model" } else { "user" },
                    "parts": [{ "text": m.content }]
                })
            }).collect::<Vec<_>>()
        })
    } else {
        // OpenAI/Grok format with tools
        serde_json::json!({
            "model": model,
            "messages": api_messages,
            "stream": true,
            "temperature": request.temperature.unwrap_or(0.7),
            "max_tokens": request.max_tokens.unwrap_or(4096),
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "get_database_schema",
                        "description": "Get the complete database schema including all tables, their columns with data types, views, and functions. Use this tool first to understand the database structure before writing queries.",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "run_sql_query",
                        "description": "Execute a SQL query against the connected database. Returns structured results with columns, rows, and row count. For SELECT queries, results are returned directly. For INSERT/UPDATE/DELETE, returns the number of affected rows.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "sql": {
                                    "type": "string",
                                    "description": "The SQL query to execute"
                                }
                            },
                            "required": ["sql"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "list_tables",
                        "description": "Get a list of all table names in the connected database. Faster than get_database_schema when you just need table names.",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": []
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_table_schema",
                        "description": "Get detailed schema information for a specific table. Returns columns with their data types, nullability, primary key status, and defaults.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "table_name": {
                                    "type": "string",
                                    "description": "The name of the table"
                                }
                            },
                            "required": ["table_name"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "execute_ddl",
                        "description": "Execute any DDL statement (CREATE, ALTER, DROP, etc.). Use this for schema modifications. ONLY one statement at a time.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "sql": {
                                    "type": "string", 
                                    "description": "The DDL statement to execute (CREATE, ALTER, DROP)"
                                }
                            },
                            "required": ["sql"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "explain_query",
                        "description": "Get the execution plan (EXPLAIN ANALYZE) for a SQL query to understand performance characteristics.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "sql": {
                                    "type": "string",
                                    "description": "The SQL query to analyze"
                                }
                            },
                            "required": ["sql"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_table_preview",
                        "description": "Get a preview of the data in a table (first N rows). Useful to understand the actual data format and content.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "table_name": {
                                    "type": "string",
                                    "description": "The name of the table"
                                },
                                "limit": {
                                    "type": "integer",
                                    "description": "Number of rows to preview (default 10)"
                                }
                            },
                            "required": ["table_name"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_table_indexes",
                        "description": "Get all indexes defined on a specific table. Use this to understand query performance and suggest new indexes.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "table_name": {
                                    "type": "string",
                                    "description": "The name of the table"
                                }
                            },
                            "required": ["table_name"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_table_foreign_keys",
                        "description": "Get all foreign key constraints for a specific table. Use this to understand table relationships.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "table_name": {
                                    "type": "string",
                                    "description": "The name of the table"
                                }
                            },
                            "required": ["table_name"]
                        }
                    }
                }
            ]
        })
    };

    let client = reqwest::Client::new();
    let response = client
        .post(api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| VelocityError::Query(format!("API request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        let _ = on_event.send(AiChatChunk::Error {
            message: format!("API error {}: {}", status, error_text),
        });
        return Err(VelocityError::Query(format!("API error {}: {}", status, error_text)));
    }

    // Stream the response
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                buffer.push_str(&text);

                // Process complete SSE lines
                while let Some(line_end) = buffer.find('\n') {
                    let line = buffer[..line_end].trim().to_string();
                    buffer = buffer[line_end + 1..].to_string();

                    if line.is_empty() || line.starts_with(':') {
                        continue;
                    }

                    if let Some(data) = line.strip_prefix("data: ") {
                        if data == "[DONE]" {
                            let _ = on_event.send(AiChatChunk::Done {
                                finish_reason: Some("stop".to_string()),
                            });
                            return Ok(());
                        }

                        // Parse JSON
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                            // Handle OpenAI/Grok format
                            if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                                for choice in choices {
                                    // Check for finish reason
                                    if let Some(reason) = choice.get("finish_reason").and_then(|r| r.as_str()) {
                                        if reason != "null" && !reason.is_empty() {
                                            let _ = on_event.send(AiChatChunk::Done {
                                                finish_reason: Some(reason.to_string()),
                                            });
                                        }
                                    }

                                    // Get delta content
                                    if let Some(delta) = choice.get("delta") {
                                        // Text content
                                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                            if !content.is_empty() {
                                                let _ = on_event.send(AiChatChunk::TextDelta {
                                                    text: content.to_string(),
                                                });
                                            }
                                        }

                                        // Tool calls
                                        if let Some(tool_calls) = delta.get("tool_calls").and_then(|t| t.as_array()) {
                                            for tool_call in tool_calls {
                                                if let (Some(id), Some(function)) = (
                                                    tool_call.get("id").and_then(|i| i.as_str()),
                                                    tool_call.get("function"),
                                                ) {
                                                    let name = function.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                                    let args = function.get("arguments").and_then(|a| a.as_str()).unwrap_or("{}");
                                                    let _ = on_event.send(AiChatChunk::ToolCall {
                                                        id: id.to_string(),
                                                        name: name.to_string(),
                                                        arguments: args.to_string(),
                                                    });
                                                }
                                            }
                                        }

                                        // Reasoning (for models that support it)
                                        if let Some(reasoning) = delta.get("reasoning_content").and_then(|r| r.as_str()) {
                                            if !reasoning.is_empty() {
                                                let _ = on_event.send(AiChatChunk::Reasoning {
                                                    text: reasoning.to_string(),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Handle Gemini format
                            if let Some(candidates) = json.get("candidates").and_then(|c| c.as_array()) {
                                for candidate in candidates {
                                    if let Some(content) = candidate.get("content") {
                                        if let Some(parts) = content.get("parts").and_then(|p| p.as_array()) {
                                            for part in parts {
                                                if let Some(text) = part.get("text").and_then(|t| t.as_str()) {
                                                    let _ = on_event.send(AiChatChunk::TextDelta {
                                                        text: text.to_string(),
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                let _ = on_event.send(AiChatChunk::Error {
                    message: format!("Stream error: {}", e),
                });
                break;
            }
        }
    }

    let _ = on_event.send(AiChatChunk::Done {
        finish_reason: Some("stop".to_string()),
    });

    Ok(())
}
