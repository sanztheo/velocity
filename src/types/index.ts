export type DatabaseType = 
  | 'SQLite' 
  | 'PostgreSQL' 
  | 'MySQL' 
  | 'MariaDB' 
  | 'CockroachDB'
  | 'Redshift'
  | 'SQLServer'
  | 'Redis'
  | 'MongoDB';

export interface SslConfig {
  enabled: boolean;
  mode: 'Disable' | 'Prefer' | 'Require' | 'VerifyCA' | 'VerifyFull';
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
}

export interface ConnectionConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  database?: string | number; // string for SQL DBs, number for Redis (DB index 0-15)
  username?: string;
  password?: string;
  ssl?: SslConfig;
  path?: string; // For SQLite
  // SQL Server specific
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  // Redis specific
  useTls?: boolean;
  // MongoDB specific
  authSource?: string; // Usually "admin"
}

export interface Connection {
  id: string;
  name: string;
  dbType: DatabaseType;
  config: ConnectionConfig;
  favorite: boolean;
  color?: string;
  lastUsedAt?: string;
  createdAt: string;
  readOnly?: boolean;
  timeoutSeconds?: number;
}

export type TabType = 'query' | 'table' | 'structure' | 'erd';

export interface Tab {
  id: string;
  connectionId: string;
  type: TabType;
  title: string;
  sql?: string;
  tableName?: string;
}
