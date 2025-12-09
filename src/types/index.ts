export type DatabaseType = 'SQLite' | 'PostgreSQL' | 'MySQL' | 'MariaDB' | 'SQLServer';

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
  // State specific to query tab
  sql?: string;
  // State specific to table/structure tab
  tableName?: string;
}
