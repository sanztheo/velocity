//! AI-powered SQL completion using OpenAI API
//!
//! This module now only handles API key management.
//! The actual AI logic has been moved to the frontend using Vercel AI SDK.

use crate::error::VelocityError;

/// AI API Keys response (without exposing actual keys to logs)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiApiKeysStatus {
    pub grok_available: bool,
    pub openai_available: bool,
    pub gemini_available: bool,
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
