use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::error::VelocityError;
use crate::models::connection::Connection;
use crate::commands::database::{ExecuteResult, PendingChange, ForeignKeyInfo};
use super::enums::DatabasePool;
use super::types::{ColumnInfo, TableData};

// Delegate functions
use super::metadata::{list_databases, list_tables, list_views, list_functions, get_table_schema, get_table_foreign_keys};
use super::data::get_table_data;
use super::mutation::execute_changes;

/// Global connection pool manager
pub struct ConnectionPoolManager {
    pools: RwLock<HashMap<String, Arc<DatabasePool>>>,
}

impl Default for ConnectionPoolManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionPoolManager {
    pub fn new() -> Self {
        Self {
            pools: RwLock::new(HashMap::new()),
        }
    }

    /// Test a connection without storing it
    pub async fn test_connection(connection: &Connection) -> Result<(), VelocityError> {
        crate::db::factory::DatabaseFactory::test_connection(connection).await
    }

    /// Connect and store the pool
    pub async fn connect(&self, connection: &Connection) -> Result<(), VelocityError> {
        println!("[VELOCITY] Starting connection to: {}", connection.name);
        let pool = crate::db::factory::DatabaseFactory::create_pool(connection).await?;
        println!(
            "[VELOCITY] Pool created successfully for: {}",
            connection.name
        );

        let mut pools = self.pools.write().await;
        pools.insert(connection.id.clone(), Arc::new(pool));
        println!("[VELOCITY] Connection stored: {}", connection.id);
        Ok(())
    }

    /// Disconnect and remove the pool
    pub async fn disconnect(&self, connection_id: &str) -> Result<(), VelocityError> {
        let mut pools = self.pools.write().await;
        if let Some(pool) = pools.remove(connection_id) {
            if let Ok(p) = Arc::try_unwrap(pool) {
                match p {
                    DatabasePool::Postgres(pool) => pool.close().await,
                    DatabasePool::MySQL(pool) => pool.close().await,
                    DatabasePool::SQLite(pool) => pool.close().await,
                    DatabasePool::SQLServer(_) => {}
                    DatabasePool::Redis(_) => {}
                    DatabasePool::MongoDB(_) => {} // MongoDB client drops automatically
                }
            }
        }
        Ok(())
    }

    pub async fn is_connected(&self, connection_id: &str) -> bool {
        self.pools.read().await.contains_key(connection_id)
    }

    pub async fn get_pool(&self, connection_id: &str) -> Option<Arc<DatabasePool>> {
        self.pools.read().await.get(connection_id).cloned()
    }

    // --- Delegation methods ---

    pub async fn list_databases(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        list_databases(&pool).await
    }

    pub async fn list_tables(
        &self,
        connection_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
        search: Option<String>,
    ) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        list_tables(&pool, limit, offset, search).await
    }

    pub async fn list_views(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        list_views(&pool).await
    }

    pub async fn list_functions(&self, connection_id: &str) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        list_functions(&pool).await
    }

    pub async fn get_table_foreign_keys(
        &self,
        connection_id: &str,
        table_name: &str,
    ) -> Result<Vec<ForeignKeyInfo>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        get_table_foreign_keys(&pool, table_name).await
    }

    pub async fn get_table_schema(
        &self,
        connection_id: &str,
        table_name: &str,
    ) -> Result<Vec<ColumnInfo>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        get_table_schema(&pool, table_name).await
    }

    pub async fn get_table_data(
        &self,
        connection_id: &str,
        table_name: &str,
        limit: i32,
        offset: i32,
    ) -> Result<TableData, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        get_table_data(&pool, table_name, limit, offset).await
    }

    pub async fn execute_changes(
        &self,
        connection_id: &str,
        table_name: &str,
        primary_key_column: &str,
        changes: Vec<PendingChange>,
    ) -> Result<ExecuteResult, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::NotFound(format!("Connection {} not found", connection_id)))?;
        execute_changes(&pool, table_name, primary_key_column, changes).await
    }

    pub async fn get_column_values(
        &self,
        connection_id: &str,
        table_name: &str,
        column_name: &str,
    ) -> Result<Vec<String>, VelocityError> {
        let pool = self
            .get_pool(connection_id)
            .await
            .ok_or_else(|| VelocityError::Connection("Not connected".to_string()))?;
        // delegate to data::get_column_values, limit 100
        super::data::get_column_values(&pool, table_name, column_name, 100).await
    }
}
