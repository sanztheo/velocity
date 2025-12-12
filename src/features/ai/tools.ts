import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';

// Helper to invoke Tauri commands
const invokeCommand = async (command: string, args: Record<string, unknown> = {}) => {
  try {
    return await invoke(command, args);
  } catch (error) {
    return { error: String(error) };
  }
};

export type ConfirmationChecker = (toolName: string, args: Record<string, unknown>) => Promise<void>;

export const createTools = (connectionId: string, checkConfirmation?: ConfirmationChecker) => ({
  get_database_schema: {
    description: 'Get the complete database schema including all tables, their columns with data types, views, and functions. Use this tool first to understand the database structure before writing queries.',
    parameters: z.object({}),
    execute: async () => {
      return await invokeCommand('get_database_schema_full', { id: connectionId });
    },
  },

  run_sql_query: {
    description: 'Execute a SQL query against the connected database. Returns structured results with columns, rows, and row count. For SELECT queries, results are returned directly. For INSERT/UPDATE/DELETE, returns the number of affected rows.',
    parameters: z.object({
      sql: z.string().describe('The SQL query to execute'),
    }),
    execute: async ({ sql }: { sql: string }) => {
      if (checkConfirmation) await checkConfirmation('run_sql_query', { sql });
      return await invokeCommand('execute_sql_safe', { connectionId, sql });
    },
  },

  list_tables: {
    description: 'Get a list of all table names in the connected database. Faster than get_database_schema when you just need table names.',
    parameters: z.object({}),
    execute: async () => {
      return await invokeCommand('list_tables', { id: connectionId });
    },
  },

  get_table_schema: {
    description: 'Get detailed schema information for a specific table. Returns columns with their data types, nullability, primary key status, and defaults.',
    parameters: z.object({
      table_name: z.string().describe('The name of the table'),
    }),
    execute: async ({ table_name }: { table_name: string }) => {
      return await invokeCommand('get_table_schema', { connectionId, tableName: table_name });
    },
  },

  execute_ddl: {
    description: 'Execute any DDL statement (CREATE, ALTER, DROP, etc.). Use this for schema modifications. ONLY one statement at a time.',
    parameters: z.object({
      sql: z.string().describe('The DDL statement to execute (CREATE, ALTER, DROP)'),
    }),
    execute: async ({ sql }: { sql: string }) => {
      if (checkConfirmation) await checkConfirmation('execute_ddl', { sql });
      return await invokeCommand('execute_ddl', { id: connectionId, sql });
    },
  },

  explain_query: {
    description: 'Get the execution plan (EXPLAIN ANALYZE) for a SQL query to understand performance characteristics.',
    parameters: z.object({
      sql: z.string().describe('The SQL query to analyze'),
    }),
    execute: async ({ sql }: { sql: string }) => {
      return await invokeCommand('explain_query', { connectionId, sql });
    },
  },

  get_table_preview: {
    description: 'Get a preview of the data in a table (first N rows). Useful to understand the actual data format and content.',
    parameters: z.object({
      table_name: z.string().describe('The name of the table'),
      limit: z.number().optional().default(10).describe('Number of rows to preview (default 10)'),
    }),
    execute: async ({ table_name, limit }: { table_name: string; limit?: number }) => {
      return await invokeCommand('get_table_data', { connectionId, tableName: table_name, limit: limit || 10, offset: 0 });
    },
  },

  get_table_indexes: {
    description: 'Get all indexes defined on a specific table. Use this to understand query performance and suggest new indexes.',
    parameters: z.object({
      table_name: z.string().describe('The name of the table'),
    }),
    execute: async ({ table_name }: { table_name: string }) => {
      return await invokeCommand('get_table_indexes', { connectionId, tableName: table_name });
    },
  },

  get_table_foreign_keys: {
    description: 'Get all foreign key constraints for a specific table. Use this to understand table relationships.',
    parameters: z.object({
      table_name: z.string().describe('The name of the table'),
    }),
    execute: async ({ table_name }: { table_name: string }) => {
      return await invokeCommand('get_table_foreign_keys', { connectionId, tableName: table_name });
    },
  },
});
