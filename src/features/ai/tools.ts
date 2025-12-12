// AI Tools for Velocity Agent
// These tools connect to Tauri commands via IPC

import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import type { DatabaseSchemaInfo, SafeQueryResult, ExplainResult, ColumnInfo } from './types';

// =============================================================================
// Tool Schemas
// =============================================================================

export const getDatabaseSchemaSchema = z.object({});

export const runSqlQuerySchema = z.object({
  sql: z.string().describe('The SQL query to execute. Use proper SQL syntax for the connected database type.'),
});

export const explainQuerySchema = z.object({
  sql: z.string().describe('The SQL query to analyze'),
});

export const listTablesSchema = z.object({});

export const getTablePreviewSchema = z.object({
  tableName: z.string().describe('The name of the table to preview'),
  limit: z.number().optional().describe('Number of rows to return (default: 10)'),
});

export const getTableSchemaSchema = z.object({
  tableName: z.string().describe('The name of the table to get schema for'),
});

export const getTableIndexesSchema = z.object({
  tableName: z.string().describe('The name of the table to get indexes for'),
});

export const getTableForeignKeysSchema = z.object({
  tableName: z.string().describe('The name of the table to get foreign keys for'),
});

export const validateSqlSchema = z.object({
  sql: z.string().describe('The SQL query to validate without executing'),
});

export const createTableSchema = z.object({
  tableName: z.string().describe('The name of the new table'),
  columns: z.array(z.object({
    name: z.string().describe('Column name'),
    dataType: z.string().describe('SQL data type (e.g., VARCHAR(255), INTEGER, TEXT, BOOLEAN)'),
    isNullable: z.boolean().optional().describe('Whether the column can be NULL'),
    isPrimaryKey: z.boolean().optional().describe('Whether this is the primary key'),
    defaultValue: z.string().optional().describe('Default value for the column'),
  })).describe('Array of column definitions'),
});

export const generateInsertTemplateSchema = z.object({
  tableName: z.string().describe('The name of the table to generate INSERT for'),
});

export const executeDdlSchema = z.object({
  sql: z.string().describe('The DDL statement to execute (CREATE, ALTER, DROP)'),
});

// =============================================================================
// Tool Definitions for AI SDK v5
// =============================================================================

export const velocityToolDefinitions = {
  // Core tools
  get_database_schema: {
    description: `Get the complete database schema including all tables, their columns with data types, views, and functions.
Use this tool first to understand the database structure before writing queries.`,
    inputSchema: getDatabaseSchemaSchema,
  },
  run_sql_query: {
    description: `Execute a SQL query against the connected database. Returns structured results with columns, rows, and row count.
For SELECT queries, results are returned directly.
For INSERT/UPDATE/DELETE, returns the number of affected rows.
IMPORTANT: Mutations require user confirmation unless auto-accept is enabled.`,
    inputSchema: runSqlQuerySchema,
  },
  explain_query: {
    description: `Get the execution plan (EXPLAIN ANALYZE) for a SQL query to understand performance characteristics.
Use this to analyze slow queries and suggest optimizations like indexes.`,
    inputSchema: explainQuerySchema,
  },
  
  // Table exploration tools
  list_tables: {
    description: `Get a list of all table names in the connected database.
Faster than get_database_schema when you just need table names.`,
    inputSchema: listTablesSchema,
  },
  get_table_preview: {
    description: `Get a preview of the data in a table (first N rows).
Useful to understand the actual data format and content.`,
    inputSchema: getTablePreviewSchema,
  },
  get_table_schema: {
    description: `Get detailed schema information for a specific table.
Returns columns with their data types, nullability, primary key status, and defaults.`,
    inputSchema: getTableSchemaSchema,
  },
  get_table_indexes: {
    description: `Get all indexes defined on a specific table.
Use this to understand query performance and suggest new indexes.`,
    inputSchema: getTableIndexesSchema,
  },
  get_table_foreign_keys: {
    description: `Get all foreign key constraints for a specific table.
Use this to understand table relationships.`,
    inputSchema: getTableForeignKeysSchema,
  },
  
  // SQL validation
  validate_sql: {
    description: `Validate SQL syntax without executing the query.
Use this to check for errors before running a query.`,
    inputSchema: validateSqlSchema,
  },
  
  // Schema modification tools
  create_table: {
    description: `Create a new table with the specified columns.
Generates and executes the CREATE TABLE statement.
IMPORTANT: This is a DDL operation that requires user confirmation.`,
    inputSchema: createTableSchema,
  },
  execute_ddl: {
    description: `Execute any DDL statement (CREATE, ALTER, DROP, etc.).
Use this for custom schema modifications that other tools don't cover.
IMPORTANT: DDL operations require user confirmation.`,
    inputSchema: executeDdlSchema,
  },
  
  // Helper tools
  generate_insert_template: {
    description: `Generate an INSERT statement template for a table.
Returns a template with placeholders for each column.`,
    inputSchema: generateInsertTemplateSchema,
  },
} as const;

// =============================================================================
// Tool Execution Functions
// =============================================================================

export async function executeDatabaseSchemaTool(connectionId: string): Promise<DatabaseSchemaInfo> {
  return await invoke<DatabaseSchemaInfo>('get_database_schema_full', { connectionId });
}

export async function executeSqlQueryTool(connectionId: string, sql: string): Promise<SafeQueryResult> {
  return await invoke<SafeQueryResult>('execute_sql_safe', { id: connectionId, sql });
}

export async function executeExplainTool(connectionId: string, sql: string): Promise<ExplainResult> {
  return await invoke<ExplainResult>('explain_query', { id: connectionId, sql });
}

export async function executeListTablesTool(connectionId: string): Promise<string[]> {
  return await invoke<string[]>('list_tables', { id: connectionId, limit: null, offset: null });
}

export async function executeGetTablePreviewTool(
  connectionId: string,
  tableName: string,
  limit: number = 10
): Promise<SafeQueryResult> {
  // Use safe SQL execution to preview table data
  const sql = `SELECT * FROM "${tableName}" LIMIT ${limit}`;
  return await invoke<SafeQueryResult>('execute_sql_safe', { id: connectionId, sql });
}

export async function executeGetTableSchemaTool(
  connectionId: string,
  tableName: string
): Promise<ColumnInfo[]> {
  return await invoke<ColumnInfo[]>('get_table_schema', { id: connectionId, tableName });
}

interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export async function executeGetTableIndexesTool(
  connectionId: string,
  tableName: string
): Promise<IndexInfo[]> {
  return await invoke<IndexInfo[]>('get_table_indexes', { id: connectionId, tableName });
}

interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export async function executeGetTableForeignKeysTool(
  connectionId: string,
  tableName: string
): Promise<ForeignKeyInfo[]> {
  return await invoke<ForeignKeyInfo[]>('get_table_foreign_keys', { id: connectionId, tableName });
}

export async function executeValidateSqlTool(
  connectionId: string,
  sql: string
): Promise<{ valid: boolean; error?: string }> {
  // Use EXPLAIN to validate SQL syntax without executing
  try {
    await invoke<ExplainResult>('explain_query', { id: connectionId, sql });
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid SQL syntax' 
    };
  }
}

interface ColumnDefinition {
  name: string;
  dataType: string;
  isNullable?: boolean;
  isPrimaryKey?: boolean;
  defaultValue?: string;
}

export async function executeCreateTableTool(
  connectionId: string,
  tableName: string,
  columns: ColumnDefinition[]
): Promise<SafeQueryResult> {
  // Build CREATE TABLE SQL
  const columnDefs = columns.map(col => {
    let def = `"${col.name}" ${col.dataType}`;
    if (col.isPrimaryKey) def += ' PRIMARY KEY';
    if (!col.isNullable && !col.isPrimaryKey) def += ' NOT NULL';
    if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
    return def;
  }).join(', ');
  
  const sql = `CREATE TABLE "${tableName}" (${columnDefs})`;
  return await invoke<SafeQueryResult>('execute_sql_safe', { id: connectionId, sql });
}

export async function executeGenerateInsertTemplateTool(
  connectionId: string,
  tableName: string
): Promise<string> {
  // Get table schema
  const columns = await invoke<ColumnInfo[]>('get_table_schema', { id: connectionId, tableName });
  
  const columnNames = columns.map(c => `"${c.name}"`).join(', ');
  const placeholders = columns.map(c => `<${c.name}:${c.dataType}>`).join(', ');
  
  return `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders});`;
}

export async function executeDdlTool(connectionId: string, sql: string): Promise<SafeQueryResult> {
  return await invoke<SafeQueryResult>('execute_sql_safe', { id: connectionId, sql });
}

// =============================================================================
// Utility Functions
// =============================================================================

export function isSqlMutation(sql: string): boolean {
  const normalizedSql = sql.trim().toUpperCase();
  const mutationKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'];
  return mutationKeywords.some(keyword => normalizedSql.startsWith(keyword));
}

export function isSqlDdl(sql: string): boolean {
  const normalizedSql = sql.trim().toUpperCase();
  const ddlKeywords = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
  return ddlKeywords.some(keyword => normalizedSql.startsWith(keyword));
}

export function formatToolResult(result: unknown): string {
  if (typeof result === 'string') return result;
  return JSON.stringify(result, null, 2);
}
