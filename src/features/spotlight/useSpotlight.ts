import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/app.store';
import { listTables, listViews, listFunctions } from '@/lib/tauri';

export type SpotlightItem = {
  id: string;
  type: 'table' | 'view' | 'function' | 'connection' | 'action';
  name: string;
  connectionId?: string;
  connectionName?: string;
  icon?: string;
  shortcut?: string;
};

interface ConnectionData {
  tables: string[];
  views: string[];
  functions: string[];
}

export function useSpotlight() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [connectionData, setConnectionData] = useState<ConnectionData>({ tables: [], views: [], functions: [] });
  const [isLoading, setIsLoading] = useState(false);

  const { connections, activeConnectionId, addTab, setActiveConnection } = useAppStore();

  // Register keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search for tables
  useEffect(() => {
    if (!open || !activeConnectionId) return;

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        // We limit to 20 results for spotlight performance
        // If search is empty, we just get the first 20 tables as "recent" or "top"
        const [tables, views, functions] = await Promise.all([
          listTables(activeConnectionId, 20, 0, search), 
          listViews(activeConnectionId), // Views might not need search yet or we can add it later
          listFunctions(activeConnectionId),
        ]);
        
        setConnectionData({ tables, views, functions });
      } catch (error) {
        console.error("Failed to search tables", error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [open, activeConnectionId, search]);


  // Build searchable items
  const items = useMemo<SpotlightItem[]>(() => {
    const result: SpotlightItem[] = [];
    const activeConn = connections.find(c => c.id === activeConnectionId);

    // 1. Add connections (Client-side filtered)
    connections.forEach(conn => {
      if (!search || conn.name.toLowerCase().includes(search.toLowerCase())) {
        result.push({
          id: `conn-${conn.id}`,
          type: 'connection',
          name: conn.name,
          connectionId: conn.id,
        });
      }
    });

    // 2. Add database objects for active connection (Server-side filtered already)
    if (activeConnectionId) {
      connectionData.tables.forEach(table => {
        result.push({
          id: `table-${activeConnectionId}-${table}`,
          type: 'table',
          name: table,
          connectionId: activeConnectionId,
          connectionName: activeConn?.name,
        });
      });

      // Views and Functions are currently taking all, we might want to client-side filter them
      // if the backend doesn't support search for them yet (it supports it for tables now)
      // Since we didn't update listViews/listFunctions backend yet, we filter here:
      connectionData.views.forEach(view => {
        if (!search || view.toLowerCase().includes(search.toLowerCase())) {
          result.push({
            id: `view-${activeConnectionId}-${view}`,
            type: 'view',
            name: view,
            connectionId: activeConnectionId,
            connectionName: activeConn?.name,
          });
        }
      });

      connectionData.functions.forEach(fn => {
        if (!search || fn.toLowerCase().includes(search.toLowerCase())) {
           result.push({
            id: `func-${activeConnectionId}-${fn}`,
            type: 'function',
            name: fn,
            connectionId: activeConnectionId,
            connectionName: activeConn?.name,
          });
        }
      });
    }

    // 3. Quick actions
    if (activeConnectionId) {
       const actions = [{
        id: 'action-new-query',
        type: 'action' as const,
        name: 'New SQL Query',
        connectionId: activeConnectionId,
        connectionName: activeConn?.name,
        shortcut: '⌘T',
      }];

      actions.forEach(action => {
          if (!search || action.name.toLowerCase().includes(search.toLowerCase())) {
              result.push(action);
          }
      });
    }

    return result;
  }, [connections, activeConnectionId, connectionData, search]);

  // Handle item selection
  const handleSelect = useCallback((item: SpotlightItem) => {
    setOpen(false);
    setSearch(''); // Reset search on close

    switch (item.type) {
      case 'table':
      case 'view':
        if (item.connectionId) {
          addTab({
            id: `${item.connectionId}-${item.name}`,
            title: item.name,
            type: 'table',
            connectionId: item.connectionId,
          });
        }
        break;
      case 'connection':
        if (item.connectionId) {
          setActiveConnection(item.connectionId);
        }
        break;
      case 'action':
        if (item.id === 'action-new-query' && item.connectionId) {
          addTab({
            id: `query-${item.connectionId}-${Date.now()}`,
            title: 'New Query',
            type: 'query',
            connectionId: item.connectionId,
          });
        }
        break;
    }
  }, [addTab, setActiveConnection]);

  return {
    open,
    setOpen,
    search,
    setSearch,
    items, // Items are now mixed (server results + client filtered others)
    isLoading,
    handleSelect,
  };
}
