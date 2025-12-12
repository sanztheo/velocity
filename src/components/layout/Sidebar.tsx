import { useState, useEffect } from "react";

import { listen } from "@tauri-apps/api/event"; // Added listen import
import { useAppStore } from "@/stores/app.store";
import { useConnections } from "@/hooks/useConnections";
import { Connection } from "@/types";
import { connectToDatabase, disconnectFromDatabase, listTables, listViews, listFunctions, deleteConnection } from "@/lib/tauri";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectionForm } from "@/components/connections/ConnectionForm";
import { CreateTableDialog } from "@/features/structure-editor";
import { DeleteConnectionDialog } from "@/components/modals/DeleteConnectionDialog";
import { ConnectionListView } from "./ConnectionListView";
import { DatabaseView } from "./DatabaseView";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

interface ConnectionState {
  tables: string[];
  views: string[];
  functions: string[];
  tablesOffset: number;
  hasMoreTables: boolean;
  isLoadingMore: boolean;
}

export function Sidebar() {
  useConnections();
  
  const { connections, setActiveConnection, addTab, openTab, activeConnectionId } = useAppStore();
  
  // Single connected connection
  const [connectedId, setConnectedId] = useState<string | null>(activeConnectionId);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectionData, setConnectionData] = useState<ConnectionState>({ 
    tables: [], 
    views: [], 
    functions: [], 
    tablesOffset: 0, 
    hasMoreTables: true,
    isLoadingMore: false
  });
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [createTableConnectionId, setCreateTableConnectionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const connectedConnection = connectedId ? connections.find(c => c.id === connectedId) : null;

  // Sync with store active connection
  useEffect(() => {
    setConnectedId(activeConnectionId);
  }, [activeConnectionId]);

  // Auto-fetch data if connected but data is missing
  useEffect(() => {
    if (connectedId && connectionData.tables.length === 0) {
      const fetchData = async () => {
        try {
          // Check if actually connected first? 
          // Assuming activeConnectionId implies we should be connected.
          // But purely local state 'connectedId' might need re-validation.
          
          const results = await Promise.allSettled([
            listTables(connectedId, 100, 0),
            listViews(connectedId).catch(() => []),
            listFunctions(connectedId).catch(() => []),
          ]);
          
          const tables = results[0].status === 'fulfilled' ? results[0].value : [];
          const views = results[1].status === 'fulfilled' ? results[1].value : [];
          const functions = results[2].status === 'fulfilled' ? results[2].value : [];
          
          setConnectionData({ 
            tables, 
            views, 
            functions, 
            tablesOffset: 0, 
            hasMoreTables: tables.length === 100,
            isLoadingMore: false
          });
        } catch (e) {
            // silent fail
        }
      };
      fetchData();
    }
  }, [connectedId]); // Removed connectionData.tables.length dependency to avoid loops, explicit loads only

  const handleConnect = async (conn: Connection) => {
    // If already connected to this one, do nothing
    if (connectedId === conn.id) return;

    setConnectingId(conn.id);

    try {
      // Disconnect from previous if any
      if (connectedId) {
        try {
          await disconnectFromDatabase(connectedId);
        } catch {
          // Ignore disconnect errors
        }
      }

      // Connect to new
      await connectToDatabase(conn.id);
      
      // Load tables/views/functions
      const results = await Promise.allSettled([
        listTables(conn.id, 100, 0),
        listViews(conn.id).catch(() => []),
        listFunctions(conn.id).catch(() => []),
      ]);
      
      const tables = results[0].status === 'fulfilled' ? results[0].value : [];
      const views = results[1].status === 'fulfilled' ? results[1].value : [];
      const functions = results[2].status === 'fulfilled' ? results[2].value : [];
      
      setConnectionData({ 
        tables, 
        views, 
        functions, 
        tablesOffset: 0, 
        hasMoreTables: tables.length === 100,
        isLoadingMore: false
      });
      setConnectedId(conn.id);
      setActiveConnection(conn.id);
      toast.success(`Connected to ${conn.name}`);
    } catch (error) {
      toast.error(`Failed to connect: ${error}`);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedId) return;
    
    // We don't need to find conn just for the name if we are careful
    const conn = connections.find(c => c.id === connectedId);
    try {
      await disconnectFromDatabase(connectedId);
      toast.success(`Disconnected from ${conn?.name || 'database'}`);
    } catch (error) {
      // Ignore disconnect errors
    }
    
    setConnectedId(null);
    setConnectionData({ tables: [], views: [], functions: [], tablesOffset: 0, hasMoreTables: true, isLoadingMore: false });
    
    // Close all tabs associated with this connection
    useAppStore.getState().closeTabsForConnection(connectedId);
    
    setActiveConnection(null);
  };

  const handleTableClick = (tableName: string) => {
    if (!connectedId || !connectedConnection) return;
    
    openTab({
      title: tableName,
      type: 'table',
      connectionId: connectedId,
      tableName,
    });
  };

  const handleNewQuery = () => {
    if (!connectedId) return;
    
    addTab({
      id: `query-${connectedId}-${Date.now()}`,
      title: 'New Query',
      type: 'query',
      connectionId: connectedId,
    });
  };

  const handleEdit = (conn: Connection) => {
    setEditingConnection(conn);
    setIsAddModalOpen(true);
  };

  const handleDeleteClick = (conn: Connection) => {
    setConnectionToDelete(conn);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!connectionToDelete) return;
    
    try {
      // If deleting the connected one, disconnect first
      if (connectedId === connectionToDelete.id) {
        await handleDisconnect();
      }
      
      await deleteConnection(connectionToDelete.id);
      window.location.reload();
    } catch (err) {
      toast.error("Failed to delete connection");
    } finally {
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    }
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setEditingConnection(null);
  };

  // Auto-fetch subsequent chunks if there are more tables
  useEffect(() => {
    if (connectedId && connectionData.hasMoreTables && connectionData.tables.length > 0) {
      const timer = setTimeout(() => {
        handleLoadMoreTables();
      }, 50); // Small delay to keep UI responsive
      
      return () => clearTimeout(timer);
    }
  }, [connectedId, connectionData.tables.length, connectionData.hasMoreTables]);

  const handleLoadMoreTables = async () => {
    if (!connectedId || !connectionData.hasMoreTables || connectionData.isLoadingMore) return;

    setConnectionData(prev => ({ ...prev, isLoadingMore: true }));

    try {
      const nextOffset = connectionData.tablesOffset + 100;
      const newTables = await listTables(connectedId, 100, nextOffset);
      
      setConnectionData(prev => ({
        ...prev,
        tables: [...prev.tables, ...newTables],
        tablesOffset: nextOffset,
        hasMoreTables: newTables.length === 100,
        isLoadingMore: false
      }));
    } catch {
      setConnectionData(prev => ({ ...prev, isLoadingMore: false }));
    }
  };

  const refreshTables = async () => {
    if (!connectedId) return;
    
    try {
      const tables = await listTables(connectedId, 100, 0);
      setConnectionData(prev => ({ ...prev, tables, tablesOffset: 0, hasMoreTables: tables.length === 100, isLoadingMore: false }));
    } catch {
      // Ignore
    }
  };

  // Listen for schema changes (from AI or other tabs)
  useEffect(() => {
    if (!connectedId) return;

    const unlisten = listen<string>('database:schema-changed', (event) => {
      // Only refresh if the event is for the current connection
      if (event.payload === connectedId) {
        refreshTables();
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [connectedId]);

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border relative">
      <div className="absolute top-0 left-0 w-full h-10 z-50 pointer-events-none">
        <div className="w-full h-full pointer-events-auto" data-tauri-drag-region />
      </div>
      <div className="h-4 w-full shrink-0" />
      <div className="flex-1 min-h-0 overflow-hidden">
        {connectedConnection ? (
          <DatabaseView
            connection={connectedConnection}
            tables={connectionData.tables}
            views={connectionData.views}
            functions={connectionData.functions}
            hasMoreTables={connectionData.hasMoreTables}
            onLoadMoreTables={handleLoadMoreTables}
            onBack={handleDisconnect}
            onTableClick={handleTableClick}
            onNewQuery={handleNewQuery}
            onNewTable={() => setCreateTableConnectionId(connectedId)}
            onViewERD={() => {
              if (!connectedId) return;
              addTab({
                id: `erd-${connectedId}`,
                title: 'Relationship Diagram',
                type: 'erd',
                connectionId: connectedId,
              });
            }}
            onEdit={() => handleEdit(connectedConnection)}
            onDelete={() => handleDeleteClick(connectedConnection)}
          />
        ) : (
          <ConnectionListView
            connections={connections}
            connectingId={connectingId}
            onConnect={handleConnect}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onAddNew={() => setIsAddModalOpen(true)}
          />
        )}
      </div>

      {/* Add/Edit Connection Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => !open && handleModalClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingConnection ? 'Edit Connection' : 'New Connection'}</DialogTitle>
            <DialogDescription>
              {editingConnection ? 'Update your database connection details.' : 'Add a new database connection.'}
            </DialogDescription>
          </DialogHeader>
          <ConnectionForm
            connection={editingConnection || undefined}
            onSuccess={handleModalClose}
            onCancel={handleModalClose}
          />
        </DialogContent>
      </Dialog>

      {/* Create Table Dialog */}
      {createTableConnectionId && (
        <CreateTableDialog
          isOpen={true}
          onClose={() => setCreateTableConnectionId(null)}
          connectionId={createTableConnectionId}
          onTableCreated={refreshTables}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConnectionDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        connectionName={connectionToDelete?.name}
      />

      <div className="py-2 px-2 mt-auto">
        <div className="flex items-center justify-between ">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground rounded-xl"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Button>
        </div>
      </div>
      
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}
