import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash, Link2 } from 'lucide-react';
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
import { ForeignKeyInfo } from '@/lib/tauri';

interface ForeignKeyPanelProps {
  connectionId: string;
  tableName: string;
  foreignKeys: ForeignKeyInfo[];
  onRefresh: () => void;
}

export function ForeignKeyPanel({ connectionId, tableName, foreignKeys, onRefresh }: ForeignKeyPanelProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (constraintName: string) => {
    if (!confirm(`Are you sure you want to delete constraint "${constraintName}"?`)) return;

    setIsDeleting(constraintName);
    try {
      // 1. Get Preview
      const sql = await api.previewDropConstraint(connectionId, tableName, constraintName);
      
      // 2. Execute
      await api.executeDdl(connectionId, sql);
      
      toast.success(`Constraint ${constraintName} deleted`);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete FK:', error);
      toast.error('Failed to delete foreign key');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Foreign Keys</h3>
        <Button size="sm" onClick={() => toast.info('Create Foreign Key UI coming soon')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Foreign Key
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Constraint</TableHead>
              <TableHead>Column</TableHead>
              <TableHead>Referenced Table</TableHead>
              <TableHead>Referenced Column</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {foreignKeys.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                   No foreign keys found
                 </TableCell>
               </TableRow>
            ) : (
              foreignKeys.map((fk) => (
                <TableRow key={fk.constraintName}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-muted-foreground" />
                    {fk.constraintName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{fk.columnName}</Badge>
                  </TableCell>
                  <TableCell>{fk.referencedTable}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{fk.referencedColumn}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(fk.constraintName)}
                      disabled={isDeleting === fk.constraintName}
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
