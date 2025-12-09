import { useState } from "react";
import { useAppStore } from "@/stores/app.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Database, MoreVertical, Trash, Edit, Star } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectionForm } from "@/components/connections/ConnectionForm";
import { useConnections } from "@/hooks/useConnections";
import { Connection } from "@/types";

export function Sidebar() {
  // Trigger initial load
  useConnections(); 
  
  const { connections, setActiveConnection, activeConnectionId } = useAppStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);

  const { delete: deleteMutation } = useConnections();

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
          {connections.map((conn) => (
            <div 
              key={conn.id} 
              className={cn(
                "group flex items-center justify-between text-sm p-2 rounded cursor-pointer transition-colors text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground",
                activeConnectionId === conn.id && "bg-sidebar-active text-sidebar-active-foreground font-medium"
              )}
              onClick={() => setActiveConnection(conn.id)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Database className={cn("h-4 w-4 shrink-0", conn.color ? `text-[${conn.color}]` : "text-muted-foreground")} />
                <span className="truncate">{conn.name}</span>
                {conn.favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
          ))}
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
