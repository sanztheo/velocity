use std::sync::Arc;
use tauri::State;
use crate::ssh::tunnel::{SshTunnelConfig, SshTunnelManager};

/// Create an SSH tunnel for a connection
#[tauri::command]
pub async fn create_ssh_tunnel(
    manager: State<'_, Arc<SshTunnelManager>>,
    connection_id: String,
    config: SshTunnelConfig,
) -> Result<u16, String> {
    manager.create_tunnel(&connection_id, &config).await
}

/// Close an SSH tunnel
#[tauri::command]
pub async fn close_ssh_tunnel(
    manager: State<'_, Arc<SshTunnelManager>>,
    connection_id: String,
) -> Result<(), String> {
    manager.close_tunnel(&connection_id).await
}

/// Get the local port for an existing tunnel
#[tauri::command]
pub async fn get_tunnel_port(
    manager: State<'_, Arc<SshTunnelManager>>,
    connection_id: String,
) -> Result<Option<u16>, String> {
    Ok(manager.get_local_port(&connection_id).await)
}
