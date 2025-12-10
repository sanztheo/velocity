import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileText, Database, Loader2, AlertCircle } from "lucide-react";
import { importCsvPreview, importCsv, importSql, CsvPreview, ColumnMapping, getTableSchema, ColumnInfo } from "@/lib/tauri";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";

type ImportType = "csv" | "sql";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  tableName?: string;
  onImportComplete?: () => void;
}

export function ImportDialog({
  isOpen,
  onClose,
  connectionId,
  tableName,
  onImportComplete,
}: ImportDialogProps) {
  const [importType, setImportType] = useState<ImportType>("csv");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [tableColumns, setTableColumns] = useState<ColumnInfo[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  useEffect(() => {
    if (isOpen && tableName && connectionId) {
      loadTableSchema();
    }
  }, [isOpen, tableName, connectionId]);

  const loadTableSchema = async () => {
    if (!tableName) return;
    try {
      const schema = await getTableSchema(connectionId, tableName);
      setTableColumns(schema);
    } catch (error) {
      console.error("Failed to load table schema:", error);
    }
  };

  const handleSelectFile = async () => {
    const extensions = importType === "csv" ? ["csv", "tsv", "txt"] : ["sql"];
    const selected = await open({
      filters: [{ name: importType.toUpperCase(), extensions }],
    });
    
    if (selected && typeof selected === "string") {
      setFilePath(selected);
      
      if (importType === "csv") {
        try {
          const preview = await importCsvPreview(selected, 5);
          setCsvPreview(preview);
          
          // Auto-map columns with same names
          const autoMappings: ColumnMapping[] = preview.headers
            .filter(h => tableColumns.some(tc => tc.name.toLowerCase() === h.toLowerCase()))
            .map(h => {
              const matchedCol = tableColumns.find(tc => tc.name.toLowerCase() === h.toLowerCase());
              return {
                csv_column: h,
                table_column: matchedCol?.name || h,
                data_type: matchedCol?.dataType,
              };
            });
          setMappings(autoMappings);
        } catch (error) {
          toast.error(`Failed to preview CSV: ${error}`);
        }
      }
    }
  };

  const updateMapping = (csvColumn: string, tableColumn: string) => {
    const existing = mappings.find(m => m.csv_column === csvColumn);
    if (existing) {
      setMappings(mappings.map(m => 
        m.csv_column === csvColumn 
          ? { ...m, table_column: tableColumn }
          : m
      ));
    } else {
      setMappings([...mappings, { csv_column: csvColumn, table_column: tableColumn }]);
    }
  };

  const handleImport = async () => {
    if (!filePath) {
      toast.error("Please select a file");
      return;
    }

    setIsImporting(true);
    try {
      if (importType === "csv") {
        if (!tableName) {
          toast.error("Please select a table");
          setIsImporting(false);
          return;
        }
        
        const result = await importCsv(
          connectionId,
          tableName,
          filePath,
          mappings,
          csvPreview?.detected_delimiter
        );
        
        if (result.success) {
          toast.success(`Imported ${result.rows_imported} rows`);
          onImportComplete?.();
          onClose();
        } else {
          toast.error(`Import completed with ${result.errors.length} errors`);
        }
      } else {
        const result = await importSql(connectionId, filePath);
        
        if (result.success) {
          toast.success(`Executed ${result.rows_imported} statements`);
          onImportComplete?.();
          onClose();
        } else {
          toast.error(`Import completed with ${result.errors.length} errors`);
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(`Import failed: ${error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFilePath(null);
    setCsvPreview(null);
    setMappings([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); resetState(); } }}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </DialogTitle>
          <DialogDescription>
            Import data from a file into {tableName ? `"${tableName}"` : "your database"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Import Type</Label>
            <RadioGroup
              value={importType}
              onValueChange={(v) => { setImportType(v as ImportType); resetState(); }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  CSV File
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sql" id="sql" />
                <Label htmlFor="sql" className="flex items-center gap-2 cursor-pointer">
                  <Database className="h-4 w-4" />
                  SQL File
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Select File</Label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSelectFile} className="flex-1">
                <Upload className="mr-2 h-4 w-4" />
                {filePath ? filePath.split("/").pop() : "Choose File..."}
              </Button>
            </div>
          </div>

          {csvPreview && importType === "csv" && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Column Mapping</Label>
                  <span className="text-sm text-muted-foreground">
                    {csvPreview.total_rows} rows detected
                  </span>
                </div>
                
                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CSV Column</TableHead>
                        <TableHead>→</TableHead>
                        <TableHead>Table Column</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.headers.map((header) => (
                        <TableRow key={header}>
                          <TableCell className="font-mono text-sm">{header}</TableCell>
                          <TableCell>→</TableCell>
                          <TableCell>
                            <Select
                              value={mappings.find(m => m.csv_column === header)?.table_column || ""}
                              onValueChange={(v) => updateMapping(header, v)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select column..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Skip</SelectItem>
                                {tableColumns.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    {col.name} ({col.dataType})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Preview</Label>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvPreview.headers.map((h) => (
                          <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.rows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className="font-mono text-xs">
                              {cell.length > 30 ? `${cell.slice(0, 30)}...` : cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {!tableName && importType === "csv" && (
            <div className="flex items-center gap-2 text-amber-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              Select a table first to import CSV data
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); resetState(); }}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={isImporting || !filePath || (importType === "csv" && !tableName)}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
