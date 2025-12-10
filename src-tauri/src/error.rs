use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum VelocityError {
    #[error("Connection failed: {0}")]
    ConnectionError(String),
    
    #[error("Connection failed: {0}")]
    Connection(String),
    
    #[error("Query error: {0}")]
    QueryError(String),
    
    #[error("Query error: {0}")]
    Query(String),
    
    #[error("Timeout after {0}ms")]
    Timeout(u64),
    
    #[error("Connection not found: {0}")]
    ConnectionNotFound(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    SerdeError(#[from] serde_json::Error),
    
    #[error("Tauri error: {0}")]
    TauriError(String),
    
    #[error("Export error: {0}")]
    Export(String),
    
    #[error("Import error: {0}")]
    Import(String),
}

impl Serialize for VelocityError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
