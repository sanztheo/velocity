import { useState } from "react";
import { useAppStore } from "@/stores/app.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Database, MoreVertical, Trash, Edit, Star, ChevronRight, ChevronDown, Table, Loader2, Unplug, Plug, Eye, FunctionSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectionForm } from "@/components/connections/ConnectionForm";
import { useConnections } from "@/hooks/useConnections";
import { Connection } from "@/types";
import { connectToDatabase, disconnectFromDatabase, listTables, listViews, listFunctions } from "@/lib/tauri";
import { toast } from "sonner";

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  tables: string[];
  views: string[];
  functions: string[];
  isExpanded: boolean;
}

export function Sidebar() {
  useConnections(); 
  
  const { connections, setActiveConnection, activeConnectionId, addTab } = useAppStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});

  const { delete: deleteMutation } = useConnections();

  const getConnectionState = (id: string): ConnectionState => {
    return connectionStates[id] || { isConnected: false, isConnecting: false, tables: [], views: [], functions: [], isExpanded: false };
  };

  const handleConnect = async (conn: Connection) => {
    const state = getConnectionState(conn.id);
    
    if (state.isConnected) {
      // Toggle expand/collapse
      setConnectionStates(prev => ({
        ...prev,
        [conn.id]: { ...getConnectionState(conn.id), isExpanded: !state.isExpanded }
      }));
      return;
    }

    // Connect
    setConnectionStates(prev => ({
      ...prev,
      [conn.id]: { ...getConnectionState(conn.id), isConnecting: true }
    }));

    try {
      await connectToDatabase(conn.id);
      const [tables, views, functions] = await Promise.all([
        listTables(conn.id),
        listViews(conn.id),
        listFunctions(conn.id),
      ]);
      
      setConnectionStates(prev => ({
        ...prev,
        [conn.id]: { isConnected: true, isConnecting: false, tables, views, functions, isExpanded: true }
      }));
      
      setActiveConnection(conn.id);
      toast.success(`Connected to ${conn.name}`);
    } catch (error) {
      setConnectionStates(prev => ({
        ...prev,
        [conn.id]: { isConnected: false, isConnecting: false, tables: [], views: [], functions: [], isExpanded: false }
      }));
      toast.error(`Failed to connect: ${error}`);
    }
  };

  const handleDisconnect = async (conn: Connection, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await disconnectFromDatabase(conn.id);
      setConnectionStates(prev => ({
        ...prev,
        [conn.id]: { isConnected: false, isConnecting: false, tables: [], views: [], functions: [], isExpanded: false }
      }));
      toast.success(`Disconnected from ${conn.name}`);
    } catch (error) {
      toast.error(`Failed to disconnect: ${error}`);
    }
  };

  const handleTableClick = (conn: Connection, tableName: string) => {
    addTab({
      id: `${conn.id}-${tableName}`,
      title: tableName,
      type: "table",
      connectionId: conn.id,
    });
  };

  const handleEdit = (conn: Connection) => {
    setEditingConnection(conn);
    setIsAddModalOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this connection?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setEditingConnection(null);
  };

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border">
       <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <span className="font-semibold text-sm text-sidebar-foreground">Connections</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-sidebar-foreground hover:text-sidebar-active-foreground hover:bg-sidebar-hover"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {connections.length === 0 && (
            <div className="text-xs text-muted-foreground p-4 text-center">
              No connections found.<br/>Click + to add one.
            </div>
          )}
          {connections.map((conn) => {
            const state = getConnectionState(conn.id);
            
            return (
              <div key={conn.id}>
                <div 
                  className={cn(
                    "group flex items-center justify-between text-sm p-2 rounded cursor-pointer transition-colors text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground",
                    activeConnectionId === conn.id && "bg-sidebar-active text-sidebar-active-foreground font-medium"
                  )}
                  onClick={() => setActiveConnection(conn.id)}
                  onDoubleClick={() => handleConnect(conn)}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {state.isConnecting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : state.isConnected ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleConnect(conn); }}
                        className="shrink-0"
                      >
                        {state.isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-green-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-green-500" />
                        )}
                      </button>
                    ) : (
                      <Database className={cn("h-4 w-4 shrink-0", conn.color ? `text-[${conn.color}]` : "text-muted-foreground")} />
                    )}
                    <span className="truncate">{conn.name}</span>
                    {conn.favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                    {state.isConnected && (
                      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    )}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {state.isConnected ? (
                        <DropdownMenuItem onClick={(e) => handleDisconnect(conn, e)}>
                          <Unplug className="h-3 w-3 mr-2" /> Disconnect
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleConnect(conn); }}>
                          <Plug className="h-3 w-3 mr-2" /> Connect
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(conn); }}>
                        <Edit className="h-3 w-3 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => handleDelete(conn.id, e)}
                      >
                        <Trash className="h-3 w-3 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* Database objects list */}
                {state.isConnected && state.isExpanded && (
                  <div className="ml-4 pl-2 border-l border-sidebar-border">
                    {/* Tables */}
                    {state.tables.length > 0 && (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground py-1 px-2 font-medium">Tables</div>
                        {state.tables.map((table) => (
                          <div
                            key={table}
                            className="flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground"
                            onClick={() => handleTableClick(conn, table)}
                          >
                            <Table className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{table}</span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {/* Views */}
                    {state.views.length > 0 && (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground py-1 px-2 font-medium mt-2">Views</div>
                        {state.views.map((view) => (
                          <div
                            key={view}
                            className="flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground"
                            onClick={() => handleTableClick(conn, view)}
                          >
                            <Eye className="h-3 w-3 text-blue-500" />
                            <span className="truncate">{view}</span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {/* Functions */}
                    {state.functions.length > 0 && (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground py-1 px-2 font-medium mt-2">Functions</div>
                        {state.functions.map((fn) => (
                          <div
                            key={fn}
                            className="flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground"
                          >
                            <FunctionSquare className="h-3 w-3 text-purple-500" />
                            <span className="truncate">{fn}</span>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {state.tables.length === 0 && state.views.length === 0 && state.functions.length === 0 && (
                      <div className="text-xs text-muted-foreground py-1 px-2">No objects found</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

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
    </div>
  );
}
