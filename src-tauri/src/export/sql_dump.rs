use std::path::Path;
use std::process::Command;
use crate::error::VelocityError;
use crate::models::connection::{Connection, ConnectionConfig};

/// Export database using native dump tools (pg_dump, mysqldump, sqlite3)
pub fn export_sql_dump<P: AsRef<Path>>(
    path: P,
    connection: &Connection,
) -> Result<String, VelocityError> {
    let output_path = path.as_ref().to_string_lossy().to_string();
    
    match &connection.config {
        ConnectionConfig::PostgreSQL { host, port, database, username, password, .. } |
        ConnectionConfig::CockroachDB { host, port, database, username, password, .. } |
        ConnectionConfig::Redshift { host, port, database, username, password, .. } => {
            let mut cmd = Command::new("pg_dump");
            cmd.arg("-h").arg(host)
               .arg("-p").arg(port.to_string())
               .arg("-U").arg(username)
               .arg("-d").arg(database)
               .arg("-f").arg(&output_path);
            
            if let Some(pwd) = password {
                cmd.env("PGPASSWORD", pwd);
            }
            
            let output = cmd.output()
                .map_err(|e| VelocityError::Export(format!("Failed to run pg_dump: {}", e)))?;
            
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(VelocityError::Export(format!("pg_dump failed: {}", stderr)));
            }
        }
        
        ConnectionConfig::MySQL { host, port, database, username, password, .. } |
        ConnectionConfig::MariaDB { host, port, database, username, password, .. } => {
            let mut cmd = Command::new("mysqldump");
            cmd.arg("-h").arg(host)
               .arg("-P").arg(port.to_string())
               .arg("-u").arg(username)
               .arg("--result-file").arg(&output_path)
               .arg(database);
            
            if let Some(pwd) = password {
                cmd.arg(format!("-p{}", pwd));
            }
            
            let output = cmd.output()
                .map_err(|e| VelocityError::Export(format!("Failed to run mysqldump: {}", e)))?;
            
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(VelocityError::Export(format!("mysqldump failed: {}", stderr)));
            }
        }
        
        ConnectionConfig::SQLite { path: db_path, .. } => {
            let output = Command::new("sqlite3")
                .arg(db_path)
                .arg(".dump")
                .output()
                .map_err(|e| VelocityError::Export(format!("Failed to run sqlite3: {}", e)))?;
            
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(VelocityError::Export(format!("sqlite3 dump failed: {}", stderr)));
            }
            
            std::fs::write(&output_path, &output.stdout)
                .map_err(|e| VelocityError::Export(format!("Failed to write dump: {}", e)))?;
        }
        
        _ => {
            return Err(VelocityError::Export("SQL dump not supported for this database type".to_string()));
        }
    }
    
    Ok(output_path)
}
