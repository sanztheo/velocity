pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod ssh;
pub mod store;

use commands::ai::*;
use commands::connections::*;
use commands::database::*;
use commands::keychain::*;
use commands::ssh::*;
use db::ConnectionPoolManager;
use ssh::tunnel::SshTunnelManager;
use std::sync::Arc;
use store::connections::ConnectionsStore;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file for environment variables like OPENAI_API_KEY
    let _ = dotenvy::dotenv();

    let pool_manager = Arc::new(ConnectionPoolManager::new());
    let ssh_manager = Arc::new(SshTunnelManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_keyring::init())
        .manage(pool_manager)
        .manage(ssh_manager)
        .setup(|app| {
            let store = ConnectionsStore::new(&app.handle())
                .expect("Failed to initialize connections store");
            app.manage(store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Connection CRUD
            load_connections,
            save_connection,
            delete_connection,
            // Database operations
            test_connection,
            connect,
            disconnect,
            is_connected,
            list_databases,
            list_tables,
            list_views,
            list_functions,
            get_table_schema,
            get_table_data,
            get_table_foreign_keys,
            execute_changes,
            execute_query,
            explain_query,
            // AI commands
            ai_sql_complete,
            // Keychain operations
            save_password,
            get_password,
            delete_password,
            // SSH Tunnel operations
            create_ssh_tunnel,
            close_ssh_tunnel,
            get_tunnel_port
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
