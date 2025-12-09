use crate::models::connection::Connection;
use crate::store::connections::ConnectionsStore;
use crate::error::VelocityError;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn load_connections(app: AppHandle) -> Result<Vec<Connection>, VelocityError> {
    let store = ConnectionsStore::new(&app)?;
    store.load()
}

#[tauri::command]
pub async fn save_connection(app: AppHandle, conn: Connection) -> Result<Connection, VelocityError> {
    let store = ConnectionsStore::new(&app)?;
    
    // Check if it's an update or new (simple logic: try update, if fails add)
    // Actually, store operations return the full list, but we want to return the saved connection for the UI
    // Let's refine the store logic or just use it as is.
    // Efficient way: load -> check id -> update or push -> save
    
    let mut connections = store.load()?;
    let mut is_update = false;
    
    for c in &mut connections {
        if c.id == conn.id {
            *c = conn.clone();
            is_update = true;
            break;
        }
    }
    
    if !is_update {
        connections.push(conn.clone());
    }
    
    store.save(connections)?;
    
    Ok(conn)
}

#[tauri::command]
pub async fn delete_connection(app: AppHandle, id: String) -> Result<(), VelocityError> {
    let store = ConnectionsStore::new(&app)?;
    store.delete(&id).map(|_| ())
}
