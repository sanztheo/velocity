use crate::models::connection::Connection;
use crate::error::VelocityError;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub struct ConnectionsStore {
    path: PathBuf,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct StoreData {
    connections: Vec<Connection>,
}

impl ConnectionsStore {
    pub fn new(app: &AppHandle) -> Result<Self, VelocityError> {
        let app_config_dir = app.path().app_config_dir()
            .map_err(|e| VelocityError::TauriError(e.to_string()))?;
            
        if !app_config_dir.exists() {
            fs::create_dir_all(&app_config_dir)?;
        }
        
        let path = app_config_dir.join("connections.json");
        
        Ok(Self { path })
    }
    
    pub fn load(&self) -> Result<Vec<Connection>, VelocityError> {
        if !self.path.exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&self.path)?;
        let data: StoreData = serde_json::from_str(&content)?;
        
        Ok(data.connections)
    }
    
    pub fn save(&self, connections: Vec<Connection>) -> Result<(), VelocityError> {
        let data = StoreData { connections };
        let content = serde_json::to_string_pretty(&data)?;
        
        fs::write(&self.path, content)?;
        
        Ok(())
    }
    
    pub fn add(&self, connection: Connection) -> Result<Vec<Connection>, VelocityError> {
        let mut connections = self.load()?;
        connections.push(connection);
        self.save(connections.clone())?;
        Ok(connections)
    }
    
    pub fn update(&self, connection: Connection) -> Result<Vec<Connection>, VelocityError> {
        let mut connections = self.load()?;
        if let Some(pos) = connections.iter().position(|c| c.id == connection.id) {
            connections[pos] = connection;
            self.save(connections.clone())?;
            Ok(connections)
        } else {
            Err(VelocityError::ConnectionNotFound(connection.id))
        }
    }
    
    pub fn delete(&self, id: &str) -> Result<Vec<Connection>, VelocityError> {
        let mut connections = self.load()?;
        let initial_len = connections.len();
        connections.retain(|c| c.id != id);
        
        if connections.len() == initial_len {
            return Err(VelocityError::ConnectionNotFound(id.to_string()));
        }
        
        self.save(connections.clone())?;
        Ok(connections)
    }
}
