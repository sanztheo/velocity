import { useState } from 'react';
import { IndexInfo } from './types';
import { Button } from '@/components/ui/button';
import { Plus, Trash, Key } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/tauri';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface IndexPanelProps {
  connectionId: string;
  tableName: string;
  indexes: IndexInfo[];
  onRefresh: () => void;
}

export function IndexPanel({ connectionId, tableName, indexes, onRefresh }: IndexPanelProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (indexName: string) => {
    if (!confirm(`Are you sure you want to delete index "${indexName}"?`)) return;

    setIsDeleting(indexName);
    try {
      // 1. Get Preview
      const sql = await api.previewDropIndex(connectionId, tableName, indexName);
      
      // 2. Execute
      await api.executeDdl(connectionId, sql);
      
      toast.success(`Index ${indexName} deleted`);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete index:', error);
      toast.error('Failed to delete index');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Indexes</h3>
        <Button size="sm" onClick={() => toast.info('Create Index UI coming soon')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Index
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Columns</TableHead>
              <TableHead>Unique</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indexes.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                   No indexes found
                 </TableCell>
               </TableRow>
            ) : (
              indexes.map((idx) => (
                <TableRow key={idx.name}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Key className="h-3 w-3 text-muted-foreground" />
                    {idx.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {idx.columns.map(col => (
                        <Badge key={col} variant="outline" className="text-xs">
                          {col}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {idx.unique && (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">
                        UNIQUE
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(idx.name)}
                      disabled={isDeleting === idx.name}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
