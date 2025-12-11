// AI Tools for Velocity Agent
// These tools connect to Tauri commands via IPC

import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import type { DatabaseSchemaInfo, SafeQueryResult, ExplainResult } from './types';

// Tool schemas for type safety
export const getDatabaseSchemaSchema = z.object({});

export const runSqlQuerySchema = z.object({
  sql: z.string().describe('The SQL query to execute. Use proper SQL syntax for the connected database type.'),
});

export const explainQuerySchema = z.object({
  sql: z.string().describe('The SQL query to analyze'),
});

// Tool definitions for AI SDK v5 - using inputSchema format
export const velocityToolDefinitions = {
  get_database_schema: {
    description: `Get the complete database schema including all tables, their columns with data types, views, and functions. 
Use this tool first to understand the database structure before writing queries.`,
    inputSchema: getDatabaseSchemaSchema,
  },
  run_sql_query: {
    description: `Execute a SQL query against the connected database. Returns structured results with columns, rows, and row count.
For SELECT queries, results are returned directly.
For INSERT/UPDATE/DELETE, returns the number of affected rows.`,
    inputSchema: runSqlQuerySchema,
  },
  explain_query: {
    description: `Get the execution plan (EXPLAIN ANALYZE) for a SQL query to understand performance characteristics.
Use this to analyze slow queries and suggest optimizations like indexes.`,
    inputSchema: explainQuerySchema,
  },
} as const;

/**
 * Execute get_database_schema tool via Tauri
 */
export async function executeDatabaseSchemaTool(connectionId: string): Promise<DatabaseSchemaInfo> {
  return await invoke<DatabaseSchemaInfo>('get_database_schema_full', {
    connectionId,
  });
}

/**
 * Execute run_sql_query tool via Tauri
 * Uses the safe variant that returns structured errors
 */
export async function executeSqlQueryTool(connectionId: string, sql: string): Promise<SafeQueryResult> {
  return await invoke<SafeQueryResult>('execute_sql_safe', {
    connectionId,
    sql,
  });
}

/**
 * Execute explain_query tool via Tauri
 */
export async function executeExplainTool(connectionId: string, sql: string): Promise<ExplainResult> {
  return await invoke<ExplainResult>('explain_query', {
    connectionId,
    sql,
  });
}

/**
 * Check if SQL is a mutation (INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE)
 */
export function isSqlMutation(sql: string): boolean {
  const normalizedSql = sql.trim().toUpperCase();
  const mutationKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE'];
  return mutationKeywords.some(keyword => normalizedSql.startsWith(keyword));
}

/**
 * Format tool result for display
 */
export function formatToolResult(result: unknown): string {
  if (typeof result === 'string') return result;
  return JSON.stringify(result, null, 2);
}
