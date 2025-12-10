
import { useState, useCallback } from 'react';
import { ColumnDefinition, CreateTableRequest } from './types';
import * as api from '@/lib/tauri';
import { toast } from 'sonner';

export function useSchemaEditor(connectionId: string) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  // Placeholder for future indexes/FKs
  // const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  // const [foreignKeys, setForeignKeys] = useState<ForeignKeyDefinition[]>([]);
  
  const [sqlPreview, setSqlPreview] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Column Management
  const addColumn = useCallback(() => {
    const newCol: ColumnDefinition = {
      name: `column_${columns.length + 1}`,
      dataType: 'VARCHAR',
      nullable: true,
      isPrimaryKey: false,
      isAutoIncrement: false
    };
    setColumns(prev => [...prev, newCol]);
  }, [columns.length]);

  const removeColumn = useCallback((index: number) => {
    setColumns(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateColumn = useCallback((index: number, updates: Partial<ColumnDefinition>) => {
    setColumns(prev => prev.map((col, i) => i === index ? { ...col, ...updates } : col));
  }, []);

  // SQL Preview Generation
  const generateCreatePreview = useCallback(async () => {
    if (!tableName) return;
    
    setIsPreviewLoading(true);
    try {
      const primaryKeys = columns
        .filter(c => c.isPrimaryKey)
        .map(c => c.name);

      const request: CreateTableRequest = {
        name: tableName,
        columns,
        primaryKey: primaryKeys.length > 0 ? primaryKeys : undefined
      };

      const sql = await api.previewCreateTable(connectionId, request);
      setSqlPreview(sql);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast.error('Failed to generate SQL preview');
    } finally {
      setIsPreviewLoading(false);
    }
  }, [connectionId, tableName, columns]);

  // Execution
  const executeChanges = useCallback(async () => {
    if (!sqlPreview) return;
    
    setIsExecuting(true);
    try {
      await api.executeDdl(connectionId, sqlPreview);
      toast.success('Structure updated successfully');
      setSqlPreview('');
      // Ideally reset state or close dialog here
      return true;
    } catch (error) {
      console.error('Failed to execute DDL:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsExecuting(false);
    }
  }, [connectionId, sqlPreview]);

  return {
    tableName,
    setTableName,
    columns,
    addColumn,
    removeColumn,
    updateColumn,
    sqlPreview,
    generateCreatePreview,
    executeChanges,
    isPreviewLoading,
    isExecuting
  };
}
