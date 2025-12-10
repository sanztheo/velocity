import { memo } from 'react';
import { Node, Handle, Position, NodeProps } from '@xyflow/react';
import { ColumnInfo } from '@/lib/tauri';
import { Key, Table, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TableNodeData = {
  label: string;
  columns: ColumnInfo[];
  isView?: boolean;
};

// Use generic Node type to satisfy constraints if needed, or specific custom node type
type CustomNode = Node<TableNodeData>;

const TableNode = memo(({ data }: NodeProps<CustomNode>) => {
  return (
    <div className="min-w-[200px] border rounded-md bg-sidebar shadow-md overflow-hidden text-sidebar-foreground">
      <div className="bg-muted px-3 py-2 border-b flex items-center gap-2 font-medium text-sm">
        <Table className="h-4 w-4 text-primary" />
        <span className="truncate">{data.label}</span>
      </div>
      
      <div className="p-0">
        {data.columns.map((col, index) => (
          <div 
            key={col.name} 
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-xs border-b last:border-0 hover:bg-muted/50",
              col.isPrimaryKey && "bg-primary/5 font-medium"
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              {col.isPrimaryKey ? (
                <Key className="h-3 w-3 text-yellow-500 shrink-0" />
              ) : (
                <Hash className="h-3 w-3 text-muted-foreground shrink-0 opacity-50" />
              )}
              <span className="truncate" title={col.name}>{col.name}</span>
            </div>
            <span className="text-muted-foreground text-[10px] shrink-0 font-mono">
              {col.dataType}
            </span>
            
            {/* Handles for connections */}
            <Handle 
              type="target" 
              position={Position.Left} 
              id={`${col.name}-target`}
              style={{ top: 20 + (index * 24), background: 'transparent', border: 'none' }} 
            />
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`${col.name}-source`}
              style={{ top: 20 + (index * 24), background: 'transparent', border: 'none' }}
            />
          </div>
        ))}
        {data.columns.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">
            No columns
          </div>
        )}
      </div>
    </div>
  );
});

export default TableNode;
