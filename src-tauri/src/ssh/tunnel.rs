use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::RwLock;

/// SSH Authentication method
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SshAuthMethod {
    Password { password: String },
    PrivateKey { 
        key_path: String,
        passphrase: Option<String>,
    },
}

/// SSH Tunnel configuration
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTunnelConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: SshAuthMethod,
    /// Remote host to forward to (usually the database host)
    pub remote_host: String,
    /// Remote port to forward to (database port)
    pub remote_port: u16,
}

/// Manages active SSH tunnels
pub struct SshTunnelManager {
    /// Active tunnels mapped by connection ID
    tunnels: RwLock<HashMap<String, ActiveTunnel>>,
}

struct ActiveTunnel {
    local_port: u16,
    #[allow(dead_code)]
    shutdown_tx: tokio::sync::oneshot::Sender<()>,
}

impl SshTunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: RwLock::new(HashMap::new()),
        }
    }

    /// Create an SSH tunnel and return the local port to connect to
    /// 
    /// NOTE: This is a placeholder implementation. Full SSH tunnel support
    /// requires additional work with the russh crate.
    pub async fn create_tunnel(
        &self,
        connection_id: &str,
        config: &SshTunnelConfig,
    ) -> Result<u16, String> {
        // Check if tunnel already exists
        {
            let tunnels = self.tunnels.read().await;
            if let Some(tunnel) = tunnels.get(connection_id) {
                return Ok(tunnel.local_port);
            }
        }

        // Bind to a random available port to get a port number
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind local port: {}", e))?;
        
        let local_addr = listener.local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?;
        let local_port = local_addr.port();

        // Create shutdown channel
        let (shutdown_tx, _shutdown_rx) = tokio::sync::oneshot::channel::<()>();

        // Log what would happen
        eprintln!(
            "[SSH Tunnel] Would connect to {}:{} as '{}', forwarding to {}:{}",
            config.host, config.port, config.username, config.remote_host, config.remote_port
        );

        // For now, return an error indicating SSH tunnels are not yet fully implemented
        // TODO: Implement full SSH tunnel with russh
        return Err(format!(
            "SSH tunnel support is not yet fully implemented. \
            Please connect directly to the database or use an external SSH tunnel. \
            Configuration received: {}@{}:{} -> {}:{}",
            config.username, config.host, config.port, config.remote_host, config.remote_port
        ));

        // Store tunnel info (unreachable for now)
        #[allow(unreachable_code)]
        {
            let mut tunnels = self.tunnels.write().await;
            tunnels.insert(connection_id.to_string(), ActiveTunnel {
                local_port,
                shutdown_tx,
            });
        }

        #[allow(unreachable_code)]
        Ok(local_port)
    }

    /// Close an SSH tunnel
    pub async fn close_tunnel(&self, connection_id: &str) -> Result<(), String> {
        let mut tunnels = self.tunnels.write().await;
        if let Some(tunnel) = tunnels.remove(connection_id) {
            // Send shutdown signal (ignore if receiver is already dropped)
            let _ = tunnel.shutdown_tx.send(());
        }
        Ok(())
    }

    /// Check if a tunnel exists for a connection
    #[allow(dead_code)]
    pub async fn has_tunnel(&self, connection_id: &str) -> bool {
        let tunnels = self.tunnels.read().await;
        tunnels.contains_key(connection_id)
    }

    /// Get the local port for an existing tunnel
    pub async fn get_local_port(&self, connection_id: &str) -> Option<u16> {
        let tunnels = self.tunnels.read().await;
        tunnels.get(connection_id).map(|t| t.local_port)
    }
}

impl Default for SshTunnelManager {
    fn default() -> Self {
        Self::new()
    }
}
