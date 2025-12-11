// Filter types matching the Rust backend
export type FilterOperator = 
  | 'equals'
  | 'notEquals'
  | 'like'
  | 'isNull'
  | 'isNotNull'
  | 'in'
  | 'greaterThan'
  | 'lessThan';

export interface ColumnFilter {
  column: string;
  operator: FilterOperator;
  value?: unknown;
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export type FilterLogic = 'and' | 'or';

// Cursor-based pagination (faster than offset for large tables)
export type CursorDirection = 'after' | 'before';

export interface CursorConfig {
  column: string;         // Column to use for cursor (should be indexed)
  direction: CursorDirection;
  value: unknown;         // Last seen value
}

export interface QueryOptions {
  filters: ColumnFilter[];
  filterLogic: FilterLogic;
  sort: SortConfig | null;
  limit: number;
  offset: number;
  
  // Performance options
  cursor?: CursorConfig;      // Use cursor pagination instead of offset
  skipCount?: boolean;        // Skip expensive COUNT(*) query
  selectedColumns?: string[]; // Only fetch specific columns
}

export interface TableDataResponse {
  columns: string[];
  rows: unknown[][];
  totalCount: number | null; // null when skip_count is true
  nextCursor?: unknown; // Cursor value for next page (keyset pagination)
}

// Helper to create default query options
export function createDefaultQueryOptions(limit = 100, offset = 0): QueryOptions {
  return {
    filters: [],
    filterLogic: 'and',
    sort: null,
    limit,
    offset,
  };
}

// Human-readable operator labels
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: '=',
  notEquals: '≠',
  like: 'contains',
  isNull: 'is empty',
  isNotNull: 'is not empty',
  in: 'in list',
  greaterThan: '>',
  lessThan: '<',
};

// Operators that don't require a value
export const VALUE_LESS_OPERATORS: FilterOperator[] = ['isNull', 'isNotNull'];
