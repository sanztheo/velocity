use tauri::AppHandle;
use tauri_plugin_keyring::KeyringExt;

const SERVICE_NAME: &str = "com.velocity.app";

/// Save a password to the system keychain
#[tauri::command]
pub async fn save_password(
    app: AppHandle,
    connection_id: String,
    password: String,
) -> Result<(), String> {
    let keyring = app.keyring();
    keyring
        .set_password(SERVICE_NAME, &connection_id, &password)
        .map_err(|e| format!("Failed to save password: {}", e))
}

/// Get a password from the system keychain
#[tauri::command]
pub async fn get_password(
    app: AppHandle,
    connection_id: String,
) -> Result<Option<String>, String> {
    let keyring = app.keyring();
    match keyring.get_password(SERVICE_NAME, &connection_id) {
        Ok(password_opt) => Ok(password_opt),
        Err(e) => {
            // Check if error is "password not found"
            let err_str = e.to_string();
            if err_str.contains("not found") || err_str.contains("NoPasswordFound") || err_str.contains("No password") {
                Ok(None)
            } else {
                Err(format!("Failed to get password: {}", e))
            }
        }
    }
}

/// Delete a password from the system keychain
#[tauri::command]
pub async fn delete_password(
    app: AppHandle,
    connection_id: String,
) -> Result<(), String> {
    let keyring = app.keyring();
    match keyring.delete_password(SERVICE_NAME, &connection_id) {
        Ok(_) => Ok(()),
        Err(e) => {
            // Ignore "not found" errors - password is already deleted
            let err_str = e.to_string();
            if err_str.contains("not found") || err_str.contains("NoPasswordFound") || err_str.contains("No password") {
                Ok(())
            } else {
                Err(format!("Failed to delete password: {}", e))
            }
        }
    }
}
