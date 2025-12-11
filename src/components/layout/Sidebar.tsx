import { useState } from "react";
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

interface ConnectionState {
  tables: string[];
  views: string[];
  functions: string[];
}

export function Sidebar() {
  useConnections();
  
  const { connections, setActiveConnection, addTab } = useAppStore();
  
  // Single connected connection
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectionData, setConnectionData] = useState<ConnectionState>({ tables: [], views: [], functions: [] });
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [createTableConnectionId, setCreateTableConnectionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);

  const connectedConnection = connectedId ? connections.find(c => c.id === connectedId) : null;

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
      
      setConnectionData({ tables, views, functions });
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
    
    const conn = connections.find(c => c.id === connectedId);
    try {
      await disconnectFromDatabase(connectedId);
      toast.success(`Disconnected from ${conn?.name || 'database'}`);
    } catch (error) {
      // Ignore disconnect errors
    }
    
    setConnectedId(null);
    setConnectionData({ tables: [], views: [], functions: [] });
    setActiveConnection(null);
  };

  const handleTableClick = (tableName: string) => {
    if (!connectedId || !connectedConnection) return;
    
    addTab({
      id: `table-${connectedId}-${tableName}-${Date.now()}`,
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

  const refreshTables = async () => {
    if (!connectedId) return;
    
    try {
      const tables = await listTables(connectedId, 100, 0);
      setConnectionData(prev => ({ ...prev, tables }));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Show DatabaseView when connected, ConnectionListView otherwise */}
      {connectedConnection ? (
        <DatabaseView
          connection={connectedConnection}
          tables={connectionData.tables}
          views={connectionData.views}
          functions={connectionData.functions}
          onBack={handleDisconnect}
          onTableClick={handleTableClick}
          onNewQuery={handleNewQuery}
          onNewTable={() => setCreateTableConnectionId(connectedId)}
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
    </div>
  );
}
