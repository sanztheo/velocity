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

export async function listTables(id: string, limit?: number, offset?: number): Promise<string[]> {
  return await invoke("list_tables", { id, limit, offset });
}

export async function listViews(id: string): Promise<string[]> {
  return await invoke("list_views", { id });
}

export async function listFunctions(id: string): Promise<string[]> {
  return await invoke("list_functions", { id });
}

// Table operations
export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  maxLength: number | null;
  isPrimaryKey: boolean;
}

export interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export async function getTableForeignKeys(
  connectionId: string,
  tableName: string
): Promise<ForeignKeyInfo[]> {
  return await invoke("get_table_foreign_keys", { id: connectionId, tableName });
}

export interface TableData {
  columns: string[];
  rows: unknown[][];
}

export async function getTableSchema(connectionId: string, tableName: string): Promise<ColumnInfo[]> {
  return await invoke("get_table_schema", { id: connectionId, tableName });
}

// Performance Store
import { usePerformanceStore } from "@/stores/performanceStore";

export async function getTableData(
  connectionId: string, 
  tableName: string, 
  limit: number = 100, 
  offset: number = 0
): Promise<TableData> {
  const start = performance.now();
  try {
    const result = await invoke<TableData>("get_table_data", { id: connectionId, tableName, limit, offset });
    const duration = performance.now() - start;
    usePerformanceStore.getState().recordQuery(duration, result.rows.length);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    usePerformanceStore.getState().recordQuery(duration, 0, String(error));
    throw error;
  }
}

// Filtered table data with sorting and pagination
export interface QueryOptions {
  filters: Array<{
    column: string;
    operator: string;
    value?: unknown;
  }>;
  filterLogic: 'and' | 'or';
  sort: { column: string; direction: 'asc' | 'desc' } | null;
  limit: number;
  offset: number;
}

export interface TableDataResponse {
  columns: string[];
  rows: unknown[][];
  totalCount: number | null; // null when skip_count is true
  nextCursor?: unknown; // Cursor value for next page (keyset pagination)
}

export async function getTableDataFiltered(
  connectionId: string,
  tableName: string,
  options: QueryOptions
): Promise<TableDataResponse> {
  const start = performance.now();
  try {
    const result = await invoke<TableDataResponse>("get_table_data_filtered", { id: connectionId, tableName, options });
    const duration = performance.now() - start;
    usePerformanceStore.getState().recordQuery(duration, result.rows.length);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    usePerformanceStore.getState().recordQuery(duration, 0, String(error));
    throw error;
  }
}

// Data editing
export interface PendingChange {
  rowId: string;
  column: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'update' | 'insert' | 'delete';
}

export interface ExecuteResult {
  success: boolean;
  rowsAffected: number;
  errors: string[];
}

// Execute pending changes (INSERT, UPDATE, DELETE)
export async function executeChanges(
  connectionId: string,
  tableName: string,
  primaryKeyColumn: string,
  changes: PendingChange[]
): Promise<ExecuteResult> {
  return await invoke("execute_changes", { id: connectionId, tableName, primaryKeyColumn, changes });
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

export async function executeQuery(connectionId: string, sql: string): Promise<QueryResult> {
  const start = performance.now();
  try {
    // The backend returns QueryResultData which matches our QueryResult interface
    const result = await invoke<QueryResult>("execute_query", { id: connectionId, sql });
    const duration = performance.now() - start;
    usePerformanceStore.getState().recordQuery(duration, result.row_count);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    usePerformanceStore.getState().recordQuery(duration, 0, String(error));
    throw error;
  }
}

export interface ExplainResult {
  plan: string[];
}

export async function explainQuery(connectionId: string, sql: string): Promise<ExplainResult> {
  return await invoke("explain_query", { id: connectionId, sql });
}

// AI-powered SQL completion
export interface AiCompletionRequest {
  partialSql: string;
  tableContext: string[];
  columnContext: string[];
  dbType: string;
}

export interface AiCompletionResponse {
  suggestions: string[];
}

export async function aiSqlComplete(
  request: AiCompletionRequest
): Promise<AiCompletionResponse> {
  return await invoke("ai_sql_complete", { request });
}

// ============================================================================
// Structure Management / DDL Bindings
// ============================================================================

// Schema Ops
export interface CreateTableRequest {
  tableName: string;
  columns: {
    name: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    defaultValue?: string;
  }[];
}

import { 
  ColumnDefinition, 
  IndexInfo, 
  ForeignKeyDefinition 
} from "@/features/structure-editor/types";

// Re-export types for convenience
// Re-export types for convenience
export type { ColumnDefinition, IndexInfo, ForeignKeyDefinition };

export async function previewCreateTable(
  connectionId: string, 
  request: CreateTableRequest
): Promise<string> {
  return await invoke("preview_create_table", { connectionId, request });
}

export async function executeDdl(
  connectionId: string, 
  sql: string
): Promise<void> {
  return await invoke("execute_ddl", { id: connectionId, sql });
}

export async function previewAddColumn(
  connectionId: string,
  tableName: string,
  column: ColumnDefinition
): Promise<string> {
  return await invoke("preview_add_column", { id: connectionId, tableName, column });
}

export async function previewDropColumn(
  connectionId: string,
  tableName: string,
  columnName: string
): Promise<string> {
  return await invoke("preview_drop_column", { id: connectionId, tableName, columnName });
}

export async function previewModifyColumn(
  connectionId: string,
  tableName: string,
  oldColumnName: string,
  newColumn: ColumnDefinition
): Promise<string> {
  return await invoke("preview_modify_column", { 
    id: connectionId, 
    tableName, 
    oldColumnName, 
    newColumn 
  });
}

export async function previewCreateIndex(
  connectionId: string,
  tableName: string,
  index: IndexInfo
): Promise<string> {
  return await invoke("preview_create_index", { id: connectionId, tableName, index });
}

export async function previewDropIndex(
  connectionId: string,
  tableName: string,
  indexName: string
): Promise<string> {
  return await invoke("preview_drop_index", { id: connectionId, tableName, indexName });
}

export async function previewAddForeignKey(
  connectionId: string,
  tableName: string,
  fk: ForeignKeyDefinition
): Promise<string> {
  return await invoke("preview_add_foreign_key", { id: connectionId, tableName, fk });
}

export async function previewDropConstraint(
  connectionId: string,
  tableName: string,
  constraintName: string
): Promise<string> {
  return await invoke("preview_drop_constraint", { id: connectionId, tableName, constraintName });
}

export async function getTableIndexes(
  connectionId: string,
  tableName: string
): Promise<IndexInfo[]> {
  return await invoke("get_table_indexes", { id: connectionId, tableName });
}

// Export/Import Commands
export type ExportFormat = "csv" | "json" | "excel" | "sqldump";

export interface ExportResult {
  success: boolean;
  file_path: string;
  rows_exported: number;
  message?: string;
}

export interface CsvPreview {
  headers: string[];
  rows: string[][];
  total_rows: number;
  detected_delimiter: string;
}

export interface ColumnMapping {
  csv_column: string;
  table_column: string;
  data_type?: string;
}

export interface ImportResult {
  success: boolean;
  rows_imported: number;
  errors: string[];
}

export async function exportTableData(
  id: string,
  tableName: string,
  format: ExportFormat,
  filePath: string,
  options?: Record<string, unknown>
): Promise<ExportResult> {
  return await invoke("export_table_data", { id, tableName, format, filePath, options });
}

export async function exportSqlDump(
  id: string,
  filePath: string
): Promise<ExportResult> {
  return await invoke("export_sql_dump", { id, filePath });
}

export async function importCsvPreview(
  filePath: string,
  previewRows?: number
): Promise<CsvPreview> {
  return await invoke("import_csv_preview", { filePath, previewRows });
}

export async function importCsv(
  id: string,
  tableName: string,
  filePath: string,
  mappings: ColumnMapping[],
  delimiter?: string
): Promise<ImportResult> {
  return await invoke("import_csv", { id, tableName, filePath, mappings, delimiter });
}

export async function importSql(
  id: string,
  filePath: string
): Promise<ImportResult> {
  return await invoke("import_sql", { id, filePath });
}
