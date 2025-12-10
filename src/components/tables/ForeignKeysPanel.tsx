import { useEffect, useState } from 'react';
import { getTableForeignKeys, ForeignKeyInfo } from '@/lib/tauri';
import { useAppStore } from '@/stores/app.store';
import { ArrowRight, Link2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ForeignKeysPanelProps {
  connectionId: string;
  tableName: string;
}

export function ForeignKeysPanel({ connectionId, tableName }: ForeignKeysPanelProps) {
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addTab } = useAppStore();

  useEffect(() => {
    const loadForeignKeys = async () => {
      setIsLoading(true);
      try {
        const fks = await getTableForeignKeys(connectionId, tableName);
        setForeignKeys(fks);
      } catch {
        // Table might not have FKs
        setForeignKeys([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadForeignKeys();
  }, [connectionId, tableName]);

  const handleNavigateToTable = (referencedTable: string) => {
    addTab({
      id: `${connectionId}-${referencedTable}`,
      title: referencedTable,
      type: 'table',
      connectionId,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading relations...
      </div>
    );
  }

  if (foreignKeys.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 text-muted-foreground text-sm">
        <Link2 className="h-4 w-4" />
        No foreign key relations
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Relations</span>
        <Badge variant="secondary" className="text-xs">
          {foreignKeys.length}
        </Badge>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {foreignKeys.map((fk) => (
          <Button
            key={fk.constraintName}
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => handleNavigateToTable(fk.referencedTable)}
          >
            <span className="text-blue-500 font-mono">{fk.columnName}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-green-500 font-mono">{fk.referencedTable}.{fk.referencedColumn}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
