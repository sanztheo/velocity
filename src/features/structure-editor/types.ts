export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  indexType?: string;
}

export interface ForeignKeyDefinition {
  name?: string;
  column: string;
  refTable: string;
  refColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface CreateTableRequest {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
}
