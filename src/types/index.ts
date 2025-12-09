export type DatabaseType = 
  | 'SQLite' 
  | 'PostgreSQL' 
  | 'MySQL' 
  | 'MariaDB' 
  | 'CockroachDB'
  | 'Redshift'
  | 'SQLServer'
  | 'Redis';

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
  database?: string;
  username?: string;
  password?: string;
  ssl?: SslConfig;
  path?: string; // For SQLite
  // SQL Server specific
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  // Redis specific
  useTls?: boolean;
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
}

export type TabType = 'query' | 'table' | 'structure';

export interface Tab {
  id: string;
  connectionId: string;
  type: TabType;
  title: string;
  sql?: string;
  tableName?: string;
}
