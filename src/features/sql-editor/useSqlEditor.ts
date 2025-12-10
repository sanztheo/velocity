import { useState, useCallback, useEffect } from 'react';
import { format } from 'sql-formatter';
import { QueryResult, QueryHistory } from './types';
import { executeQuery } from '@/lib/tauri';

interface UseSqlEditorProps {
  connectionId: string;
  initialSql?: string;
}

export function useSqlEditor({ connectionId, initialSql = '' }: UseSqlEditorProps) {
  const [sql, setSql] = useState(initialSql);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistory[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`sql-history-${connectionId}`);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [connectionId]);

  // Save history to localStorage
  const saveHistory = useCallback((newHistory: QueryHistory[]) => {
    setHistory(newHistory);
    localStorage.setItem(`sql-history-${connectionId}`, JSON.stringify(newHistory.slice(0, 50)));
  }, [connectionId]);

  // Execute single or multiple statements
  const execute = useCallback(async () => {
    if (!sql.trim() || isExecuting) return;

    setIsExecuting(true);
    setError(null);
    
    // Split statements by semicolon (simple split, handles most cases)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const newResults: QueryResult[] = [];
    const startTime = performance.now();

    try {
      for (const statement of statements) {
        const stmtStart = performance.now();
        const result = await executeQuery(connectionId, statement);
        const executionTime = performance.now() - stmtStart;
        
        // Extract table name from SQL (FROM tablename or UPDATE tablename or INTO tablename)
        const tableMatch = statement.match(/(?:FROM|UPDATE|INTO|JOIN)\s+["`]?(\w+)["`]?/i);
        const tableName = tableMatch ? tableMatch[1] : undefined;
        
        newResults.push({
          ...result,
          executionTime,
          tableName,
        });
      }

      setResults(newResults);
      setActiveResultIndex(0);

      // Add to history
      const totalTime = performance.now() - startTime;
      const totalRows = newResults.reduce((sum, r) => sum + r.rowCount, 0);
      
      const historyEntry: QueryHistory = {
        id: crypto.randomUUID(),
        sql: sql.trim(),
        connectionId,
        executedAt: new Date().toISOString(),
        executionTime: totalTime,
        rowCount: totalRows,
        favorite: false,
      };

      saveHistory([historyEntry, ...history.filter(h => h.sql !== sql.trim())]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsExecuting(false);
    }
  }, [sql, connectionId, isExecuting, history, saveHistory]);

  // Format SQL
  const formatSql = useCallback(() => {
    try {
      const formatted = format(sql, {
        language: 'postgresql',
        keywordCase: 'upper',
        indentStyle: 'standard',
      });
      setSql(formatted);
    } catch {
      // If formatting fails, keep original
    }
  }, [sql]);

  // Toggle favorite
  const toggleFavorite = useCallback((id: string) => {
    const updated = history.map(h => 
      h.id === id ? { ...h, favorite: !h.favorite } : h
    );
    saveHistory(updated);
  }, [history, saveHistory]);

  // Load from history
  const loadFromHistory = useCallback((entry: QueryHistory) => {
    setSql(entry.sql);
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  return {
    // State
    sql,
    setSql,
    isExecuting,
    results,
    activeResultIndex,
    setActiveResultIndex,
    error,
    history,
    
    // Actions
    execute,
    formatSql,
    toggleFavorite,
    loadFromHistory,
    clearHistory,
  };
}
