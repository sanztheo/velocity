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
