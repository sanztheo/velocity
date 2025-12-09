use async_trait::async_trait;
use russh::client;
use russh_keys::key::KeyPair;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Mutex, RwLock};

/// SSH Authentication method
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(tag = "type")]
pub enum SshAuthMethod {
    Password {
        password: String,
    },
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
    shutdown_tx: tokio::sync::broadcast::Sender<()>,
}

/// SSH client handler for russh
struct SshClientHandler;

#[async_trait]
impl client::Handler for SshClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all server keys for now
        // In production, verify against known_hosts
        Ok(true)
    }
}

impl SshTunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: RwLock::new(HashMap::new()),
        }
    }

    /// Create an SSH tunnel and return the local port to connect to
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

        // Bind to a random available port on localhost
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind local port: {}", e))?;

        let local_addr = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?;
        let local_port = local_addr.port();

        // Create SSH connection
        let ssh_handle = self.connect_ssh(config).await?;
        let ssh_handle = Arc::new(Mutex::new(ssh_handle));

        // Create shutdown channel (broadcast so we can clone receivers)
        let (shutdown_tx, _) = tokio::sync::broadcast::channel::<()>(1);
        let shutdown_rx = shutdown_tx.subscribe();

        // Clone values for the spawned task
        let remote_host = config.remote_host.clone();
        let remote_port = config.remote_port;

        // Spawn tunnel listener task
        tokio::spawn(run_tunnel_listener(
            listener,
            ssh_handle,
            remote_host,
            remote_port,
            shutdown_rx,
        ));

        // Store tunnel info
        {
            let mut tunnels = self.tunnels.write().await;
            tunnels.insert(
                connection_id.to_string(),
                ActiveTunnel {
                    local_port,
                    shutdown_tx,
                },
            );
        }

        Ok(local_port)
    }

    /// Connect to SSH server and authenticate
    async fn connect_ssh(
        &self,
        config: &SshTunnelConfig,
    ) -> Result<client::Handle<SshClientHandler>, String> {
        let ssh_config = client::Config::default();
        let ssh_config = Arc::new(ssh_config);

        let addr = format!("{}:{}", config.host, config.port);

        let mut handle = client::connect(ssh_config, &addr, SshClientHandler)
            .await
            .map_err(|e| format!("SSH connection failed to {}: {}", addr, e))?;

        // Authenticate based on method
        let authenticated = match &config.auth_method {
            SshAuthMethod::Password { password } => handle
                .authenticate_password(&config.username, password)
                .await
                .map_err(|e| format!("Password authentication failed: {}", e))?,
            SshAuthMethod::PrivateKey {
                key_path,
                passphrase,
            } => {
                let key = russh_keys::load_secret_key(key_path, passphrase.as_deref())
                    .map_err(|e| format!("Failed to load private key '{}': {}", key_path, e))?;

                handle
                    .authenticate_publickey(&config.username, Arc::new(key))
                    .await
                    .map_err(|e| format!("Public key authentication failed: {}", e))?
            }
        };

        if !authenticated {
            return Err(format!(
                "SSH authentication failed for user '{}' on {}:{}",
                config.username, config.host, config.port
            ));
        }

        Ok(handle)
    }

    /// Close an SSH tunnel
    pub async fn close_tunnel(&self, connection_id: &str) -> Result<(), String> {
        let mut tunnels = self.tunnels.write().await;
        if let Some(tunnel) = tunnels.remove(connection_id) {
            // Send shutdown signal to all listeners
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

/// Run the tunnel listener loop
async fn run_tunnel_listener(
    listener: TcpListener,
    ssh_handle: Arc<Mutex<client::Handle<SshClientHandler>>>,
    remote_host: String,
    remote_port: u16,
    mut shutdown_rx: tokio::sync::broadcast::Receiver<()>,
) {
    loop {
        tokio::select! {
            accept_result = listener.accept() => {
                match accept_result {
                    Ok((stream, peer_addr)) => {
                        eprintln!("[SSH Tunnel] New connection from {}", peer_addr);
                        let ssh = ssh_handle.clone();
                        let host = remote_host.clone();
                        let port = remote_port;

                        // Handle each connection in a separate task
                        tokio::spawn(async move {
                            if let Err(e) = handle_tunnel_connection(stream, ssh, &host, port).await {
                                eprintln!("[SSH Tunnel] Connection error: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("[SSH Tunnel] Failed to accept connection: {}", e);
                    }
                }
            }
            _ = shutdown_rx.recv() => {
                eprintln!("[SSH Tunnel] Received shutdown signal, stopping listener");
                break;
            }
        }
    }
}

/// Handle a single tunnel connection - forward TCP traffic through SSH channel
async fn handle_tunnel_connection(
    mut local_stream: TcpStream,
    ssh_handle: Arc<Mutex<client::Handle<SshClientHandler>>>,
    remote_host: &str,
    remote_port: u16,
) -> Result<(), String> {
    // Open a direct-tcpip channel through SSH
    let channel = {
        let mut handle = ssh_handle.lock().await;
        handle
            .channel_open_direct_tcpip(remote_host, remote_port as u32, "127.0.0.1", 0)
            .await
            .map_err(|e| {
                format!(
                    "Failed to open SSH channel to {}:{}: {}",
                    remote_host, remote_port, e
                )
            })?
    };

    // Convert channel to a stream for bidirectional I/O
    let mut channel_stream = channel.into_stream();

    // Split both streams for bidirectional copy
    let (mut local_read, mut local_write) = local_stream.split();
    let (mut channel_read, mut channel_write) = tokio::io::split(&mut channel_stream);

    // Copy data bidirectionally
    let client_to_server = async { tokio::io::copy(&mut local_read, &mut channel_write).await };
    let server_to_client = async { tokio::io::copy(&mut channel_read, &mut local_write).await };

    // Run both copies concurrently, finish when either completes
    tokio::select! {
        result = client_to_server => {
            if let Err(e) = result {
                if e.kind() != std::io::ErrorKind::UnexpectedEof {
                    return Err(format!("Client to server copy failed: {}", e));
                }
            }
        }
        result = server_to_client => {
            if let Err(e) = result {
                if e.kind() != std::io::ErrorKind::UnexpectedEof {
                    return Err(format!("Server to client copy failed: {}", e));
                }
            }
        }
    }

    Ok(())
}

impl Default for SshTunnelManager {
    fn default() -> Self {
        Self::new()
    }
}
