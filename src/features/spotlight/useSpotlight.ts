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
  const [connectionData, setConnectionData] = useState<Record<string, ConnectionData>>({});
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

  // Load data for active connection when spotlight opens
  useEffect(() => {
    if (!open || !activeConnectionId) return;
    
    // Only load if not already cached
    if (connectionData[activeConnectionId]) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [tables, views, functions] = await Promise.all([
          listTables(activeConnectionId),
          listViews(activeConnectionId),
          listFunctions(activeConnectionId),
        ]);
        
        setConnectionData(prev => ({
          ...prev,
          [activeConnectionId]: { tables, views, functions },
        }));
      } catch {
        // Connection might not be active
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [open, activeConnectionId, connectionData]);

  // Build searchable items
  const items = useMemo<SpotlightItem[]>(() => {
    const result: SpotlightItem[] = [];

    // Add connections
    connections.forEach(conn => {
      result.push({
        id: `conn-${conn.id}`,
        type: 'connection',
        name: conn.name,
        connectionId: conn.id,
      });
    });

    // Add database objects for active connection
    if (activeConnectionId && connectionData[activeConnectionId]) {
      const data = connectionData[activeConnectionId];
      const activeConn = connections.find(c => c.id === activeConnectionId);
      
      data.tables.forEach(table => {
        result.push({
          id: `table-${activeConnectionId}-${table}`,
          type: 'table',
          name: table,
          connectionId: activeConnectionId,
          connectionName: activeConn?.name,
        });
      });

      data.views.forEach(view => {
        result.push({
          id: `view-${activeConnectionId}-${view}`,
          type: 'view',
          name: view,
          connectionId: activeConnectionId,
          connectionName: activeConn?.name,
        });
      });

      data.functions.forEach(fn => {
        result.push({
          id: `func-${activeConnectionId}-${fn}`,
          type: 'function',
          name: fn,
          connectionId: activeConnectionId,
          connectionName: activeConn?.name,
        });
      });
    }

    // Quick actions will be added when SQL Editor is implemented
    // result.push(
    //   { id: 'action-new-connection', type: 'action', name: 'New Connection', shortcut: '⌘N' },
    //   { id: 'action-new-query', type: 'action', name: 'New SQL Query', shortcut: '⌘T' },
    // );

    return result;
  }, [connections, activeConnectionId, connectionData]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;

    const query = search.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query)
    );
  }, [items, search]);

  // Handle item selection
  const handleSelect = useCallback((item: SpotlightItem) => {
    setOpen(false);
    setSearch('');

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
        // Handle actions (to be implemented)
        break;
    }
  }, [addTab, setActiveConnection]);

  return {
    open,
    setOpen,
    search,
    setSearch,
    items: filteredItems,
    isLoading,
    handleSelect,
  };
}
