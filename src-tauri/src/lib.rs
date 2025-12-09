pub mod models;
pub mod store;
pub mod error;
pub mod commands;
pub mod db;

use std::sync::Arc;
use tauri::Manager;
use commands::connections::*;
use commands::database::*;
use db::ConnectionPoolManager;
use store::connections::ConnectionsStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pool_manager = Arc::new(ConnectionPoolManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(pool_manager)
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
            get_table_schema,
            get_table_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


