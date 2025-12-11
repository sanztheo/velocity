import { ArrowLeft, Table, Eye, FunctionSquare, MoreVertical, Terminal, Unplug, Plus, Edit, Trash } from "lucide-react";
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

interface DatabaseViewProps {
  connection: Connection;
  tables: string[];
  views: string[];
  functions: string[];
  onBack: () => void;
  onTableClick: (tableName: string) => void;
  onNewQuery: () => void;
  onNewTable: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function DatabaseView({
  connection,
  tables,
  views,
  functions,
  onBack,
  onTableClick,
  onNewQuery,
  onNewTable,
  onEdit,
  onDelete,
}: DatabaseViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <div className="p-3 border-b border-sidebar-border flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm truncate block">{connection.name}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onNewQuery}>
              <Terminal className="h-3 w-3 mr-2" /> New Query
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewTable}>
              <Plus className="h-3 w-3 mr-2" /> New Table
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-3 w-3 mr-2" /> Edit Connection
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBack}>
              <Unplug className="h-3 w-3 mr-2" /> Disconnect
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash className="h-3 w-3 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tables, Views, Functions */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {/* Tables Section */}
          {tables.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tables ({tables.length})
              </div>
              {tables.map((table) => (
                <button
                  key={table}
                  className="flex items-center gap-2 w-full text-left text-sm px-2 py-1.5 rounded hover:bg-sidebar-hover transition-colors"
                  onClick={() => onTableClick(table)}
                >
                  <Table className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{table}</span>
                </button>
              ))}
            </div>
          )}

          {/* Views Section */}
          {views.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Views ({views.length})
              </div>
              {views.map((view) => (
                <button
                  key={view}
                  className="flex items-center gap-2 w-full text-left text-sm px-2 py-1.5 rounded hover:bg-sidebar-hover transition-colors"
                  onClick={() => onTableClick(view)}
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{view}</span>
                </button>
              ))}
            </div>
          )}

          {/* Functions Section */}
          {functions.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Functions ({functions.length})
              </div>
              {functions.map((fn) => (
                <div
                  key={fn}
                  className="flex items-center gap-2 text-sm px-2 py-1.5 text-muted-foreground"
                >
                  <FunctionSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{fn}</span>
                </div>
              ))}
            </div>
          )}

          {tables.length === 0 && views.length === 0 && functions.length === 0 && (
            <div className="text-xs text-muted-foreground p-4 text-center">
              No objects found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
