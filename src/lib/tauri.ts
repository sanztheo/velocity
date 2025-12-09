import { invoke } from "@tauri-apps/api/core";
import { Connection } from "@/types";

// Connection Commands
export async function loadConnections(): Promise<Connection[]> {
  return await invoke("load_connections");
}

export async function saveConnection(conn: Connection): Promise<Connection> {
  return await invoke("save_connection", { conn });
}

export async function deleteConnection(id: string): Promise<void> {
  return await invoke("delete_connection", { id });
}

// Database Commands
export async function testConnection(conn: Connection): Promise<string> {
  return await invoke("test_connection", { conn });
}

export async function connectToDatabase(id: string): Promise<void> {
  return await invoke("connect", { id });
}

export async function disconnectFromDatabase(id: string): Promise<void> {
  return await invoke("disconnect", { id });
}

export async function isConnected(id: string): Promise<boolean> {
  return await invoke("is_connected", { id });
}

export async function listDatabases(id: string): Promise<string[]> {
  return await invoke("list_databases", { id });
}

export async function listTables(id: string): Promise<string[]> {
  return await invoke("list_tables", { id });
}

// Table operations
export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  maxLength: number | null;
  isPrimaryKey: boolean;
}

export interface TableData {
  columns: string[];
  rows: unknown[][];
}

export async function getTableSchema(connectionId: string, tableName: string): Promise<ColumnInfo[]> {
  return await invoke("get_table_schema", { connectionId, tableName });
}

export async function getTableData(
  connectionId: string, 
  tableName: string, 
  limit: number = 100, 
  offset: number = 0
): Promise<TableData> {
  return await invoke("get_table_data", { connectionId, tableName, limit, offset });
}


