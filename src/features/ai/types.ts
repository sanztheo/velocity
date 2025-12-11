// AI Agent Types for Velocity

export type AgentMode = 'fast' | 'deep';

export type AIProvider = 'grok' | 'openai' | 'gemini';

export interface AISettings {
  grokApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  preferredProvider: AIProvider;
  autoAcceptSql: boolean;
}

export type ToolCallStatus = 'pending' | 'awaiting-confirmation' | 'executing' | 'success' | 'error';

export interface ToolCallState {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
}

export interface PendingSqlConfirmation {
  toolCallId: string;
  sql: string;
  isMutation: boolean;
}

// Tauri command response types
export interface SafeQueryResult {
  success: boolean;
  columns: string[] | null;
  rows: unknown[][] | null;
  rowCount: number | null;
  errorMessage: string | null;
  errorHint: string | null;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
}

export interface TableSchemaInfo {
  name: string;
  columns: ColumnInfo[];
}

export interface DatabaseSchemaInfo {
  tables: TableSchemaInfo[];
  views: string[];
  functions: string[];
}

export interface ExplainResult {
  plan: string[];
}
