// SQL Editor Types
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTime: number;
  error?: string;
  tableName?: string; // Extracted from SQL (e.g., FROM users)
}

export interface QueryHistory {
  id: string;
  sql: string;
  connectionId: string;
  executedAt: string;
  executionTime: number;
  rowCount: number;
  favorite: boolean;
}

export interface SqlEditorState {
  sql: string;
  isExecuting: boolean;
  results: QueryResult[];
  activeResultIndex: number;
  history: QueryHistory[];
  error: string | null;
}
