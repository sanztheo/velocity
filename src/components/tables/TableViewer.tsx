import { useEffect, useState } from "react";
import { getTableSchema, getTableData, ColumnInfo, TableData } from "@/lib/tauri";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TableViewerProps {
  connectionId: string;
  tableName: string;
}

export function TableViewer({ connectionId, tableName }: TableViewerProps) {
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadData();
  }, [connectionId, tableName, page]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schemaResult, dataResult] = await Promise.all([
        getTableSchema(connectionId, tableName),
        getTableData(connectionId, tableName, pageSize, page * pageSize)
      ]);
      setSchema(schemaResult);
      setData(dataResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading table data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        <p>Error loading table: {error}</p>
        <Button variant="outline" onClick={loadData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Schema/Columns info */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex flex-wrap gap-2">
          {schema.map((col) => (
            <Badge 
              key={col.name} 
              variant="outline" 
              className="font-mono text-xs"
            >
              {col.name}
              <span className="ml-1 text-muted-foreground">
                {col.dataType}
              </span>
              {col.nullable && (
                <span className="ml-1 text-yellow-500">?</span>
              )}
            </Badge>
          ))}
        </div>
      </div>

      {/* Data table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              {data?.columns.map((col) => (
                <TableHead key={col} className="font-semibold whitespace-nowrap">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.rows.map((row, rowIdx) => (
              <TableRow key={rowIdx} className="hover:bg-secondary/50">
                {row.map((cell, cellIdx) => (
                  <TableCell key={cellIdx} className="font-mono text-sm">
                    {cell === null ? (
                      <span className="text-muted-foreground italic">NULL</span>
                    ) : typeof cell === "boolean" ? (
                      <Badge variant={cell ? "default" : "secondary"}>
                        {cell ? "true" : "false"}
                      </Badge>
                    ) : (
                      String(cell)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {data?.rows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No data in this table
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="p-3 border-t border-border bg-secondary/30 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {page * pageSize + 1} - {page * pageSize + (data?.rows.length || 0)} rows
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={(data?.rows.length || 0) < pageSize}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
