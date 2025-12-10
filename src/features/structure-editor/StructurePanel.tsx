import { useState, useEffect, useCallback } from 'react';
import { ColumnInfo, ForeignKeyInfo, IndexInfo } from '@/lib/tauri';
import * as api from '@/lib/tauri';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Columns, Key, Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { IndexPanel } from './IndexPanel';
import { ForeignKeyPanel } from './ForeignKeyPanel';
// Reusing a simplified column list for now, or building a dedicated one for existing tables
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface StructurePanelProps {
  connectionId: string;
  tableName: string;
}

export function StructurePanel({ connectionId, tableName }: StructurePanelProps) {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cols, idxs, fks] = await Promise.all([
        api.getTableSchema(connectionId, tableName),
        api.getTableIndexes(connectionId, tableName),
        api.getTableForeignKeys(connectionId, tableName)
      ]);
      setColumns(cols);
      setIndexes(idxs);
      setForeignKeys(fks);
    } catch (error) {
      console.error('Failed to fetch structure:', error);
      toast.error('Failed to load table structure');
    } finally {
        setIsLoading(false);
    }
  }, [connectionId, tableName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
             <span className="text-muted-foreground font-normal">Table:</span> {tableName}
           </h1>
           <p className="text-sm text-muted-foreground mt-1">
             Manage columns, indexes, and relationships.
           </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="columns" className="flex-1 overflow-hidden flex flex-col">
        <TabsList>
          <TabsTrigger value="columns" className="flex items-center gap-2">
            <Columns className="h-4 w-4" /> Columns
          </TabsTrigger>
          <TabsTrigger value="indexes" className="flex items-center gap-2">
            <Key className="h-4 w-4" /> Indexes
          </TabsTrigger>
          <TabsTrigger value="relations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Foreign Keys
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="columns" className="flex-1 overflow-auto mt-4">
             <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nullable</TableHead>
                      <TableHead>Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((col) => (
                      <TableRow key={col.name}>
                        <TableCell className="font-medium">{col.name}</TableCell>
                        <TableCell className="font-mono text-xs">{col.dataType}</TableCell>
                        <TableCell>
                          {col.nullable ? (
                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">NULL</Badge>
                          ) : (
                            <Badge variant="outline">NOT NULL</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {col.isPrimaryKey && <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">PK</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </div>
        </TabsContent>
        
        <TabsContent value="indexes" className="flex-1 overflow-auto mt-4">
          <IndexPanel 
            connectionId={connectionId} 
            tableName={tableName} 
            indexes={indexes} 
            onRefresh={fetchData}
          />
        </TabsContent>
        
        <TabsContent value="relations" className="flex-1 overflow-auto mt-4">
          <ForeignKeyPanel 
            connectionId={connectionId} 
            tableName={tableName} 
            foreignKeys={foreignKeys} 
            onRefresh={fetchData} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
