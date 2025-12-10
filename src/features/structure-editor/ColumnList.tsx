import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ColumnDefinition } from "./types";
import { ColumnEditor } from "./ColumnEditor";

interface ColumnListProps {
  columns: ColumnDefinition[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updates: Partial<ColumnDefinition>) => void;
}

export function ColumnList({ columns, onAdd, onRemove, onUpdate }: ColumnListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium">Columns</h3>
        <Button onClick={onAdd} size="sm" variant="outline" className="h-8 gap-2">
          <Plus className="h-4 w-4" /> Add Column
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-1 pr-2">
        {columns.map((col, idx) => (
          <ColumnEditor
            // Use index as key if name is changing, but careful with focus loss
            // Using a unique ID would be better, but for now simple index is okay for simple list
            key={idx} 
            column={col}
            onChange={(updates) => onUpdate(idx, updates)}
            onRemove={() => onRemove(idx)}
          />
        ))}
        
        {columns.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-md">
            No columns defined. Click "Add Column" to start.
          </div>
        )}
      </div>
    </div>
  );
}
