import { ArrowLeft, Table, Eye, FunctionSquare, MoreVertical, Terminal, Unplug, Plus, Edit, Trash, Network } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  onViewERD: () => void;
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
  onViewERD,
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
            <DropdownMenuItem onClick={onViewERD}>
              <Network className="h-3 w-3 mr-2 bg-transparent" /> View Relationships
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
      {/* Tables, Views, Functions */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-2 space-y-2">
          {/* Tables Section */}
          {tables.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tables ({tables.length})
              </div>
              {tables.map((table) => (
                <button
                  key={table}
                  className="flex items-center gap-2 w-full text-left text-sm px-2 py-1 rounded-sm hover:bg-sidebar-hover transition-colors group"
                  onClick={() => onTableClick(table)}
                >
                  <Table className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">{table}</span>
                </button>
              ))}
            </div>
          )}

          {/* Views Section */}
          {views.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Views ({views.length})
              </div>
              {views.map((view) => (
                <button
                  key={view}
                  className="flex items-center gap-2 w-full text-left text-sm px-2 py-1 rounded-sm hover:bg-sidebar-hover transition-colors group"
                  onClick={() => onTableClick(view)}
                >
                  <Eye className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">{view}</span>
                </button>
              ))}
            </div>
          )}

          {/* Functions Section */}
          {functions.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Functions ({functions.length})
              </div>
              {functions.map((fn) => (
                <div
                  key={fn}
                  className="flex items-center gap-2 text-sm px-2 py-1 text-muted-foreground"
                >
                  <FunctionSquare className="h-4 w-4 shrink-0" />
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
      </div>
    </div>
  );
}
