import { Database, MoreVertical, Loader2, Star, Plug, Unplug, Terminal, Plus, Edit, Trash, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Connection } from "@/types";
import { cn } from "@/lib/utils";

interface ConnectionListViewProps {
  connections: Connection[];
  connectingId: string | null;
  onConnect: (conn: Connection) => void;
  onEdit: (conn: Connection) => void;
  onDelete: (conn: Connection) => void;
  onAddNew: () => void;
}

export function ConnectionListView({
  connections,
  connectingId,
  onConnect,
  onEdit,
  onDelete,
  onAddNew,
}: ConnectionListViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <span className="font-semibold text-sm text-sidebar-foreground">Connections</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-sidebar-foreground hover:text-sidebar-active-foreground hover:bg-sidebar-hover"
          onClick={onAddNew}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Connection List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {connections.length === 0 && (
            <div className="text-xs text-muted-foreground p-4 text-center">
              No connections found.<br />Click + to add one.
            </div>
          )}

          {connections.map((conn) => {
            const isConnecting = connectingId === conn.id;

            return (
              <div
                key={conn.id}
                className="group flex items-center justify-between text-sm p-2 rounded cursor-pointer transition-colors text-sidebar-foreground hover:bg-sidebar-hover"
                onDoubleClick={() => onConnect(conn)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Database className={cn("h-4 w-4 shrink-0", conn.color ? `text-[${conn.color}]` : "text-muted-foreground")} />
                  )}
                  <span className="truncate">{conn.name}</span>
                  {conn.favorite && <Star className="h-3 w-3 shrink-0 text-yellow-500 fill-yellow-500" />}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onConnect(conn)}>
                      <Plug className="h-3 w-3 mr-2" /> Connect
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(conn)}>
                      <Edit className="h-3 w-3 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(conn)} className="text-destructive">
                      <Trash className="h-3 w-3 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
