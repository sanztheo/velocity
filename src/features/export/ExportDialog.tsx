import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Download, FileJson, FileSpreadsheet, FileText, Database, Loader2 } from "lucide-react";
import { exportTableData, exportSqlDump, ExportFormat } from "@/lib/tauri";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  tableName?: string;
  connectionName?: string;
}

export function ExportDialog({ 
  isOpen, 
  onClose, 
  connectionId, 
  tableName,
  connectionName 
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState({
    delimiter: ",",
    prettyPrint: true,
    includeHeaders: true,
  });

  const getFileExtension = (fmt: ExportFormat) => {
    switch (fmt) {
      case "csv": return "csv";
      case "json": return "json";
      case "excel": return "xlsx";
      case "sqldump": return "sql";
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const extension = getFileExtension(format);
      const defaultName = tableName 
        ? `${tableName}.${extension}`
        : `${connectionName || "database"}_dump.${extension}`;

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      });

      if (!filePath) {
        setIsExporting(false);
        return;
      }

      let result;
      if (format === "sqldump") {
        result = await exportSqlDump(connectionId, filePath);
      } else if (tableName) {
        result = await exportTableData(connectionId, tableName, format, filePath, {
          delimiter: options.delimiter,
          pretty: options.prettyPrint,
        });
      } else {
        toast.error("Please select a table to export");
        setIsExporting(false);
        return;
      }

      if (result.success) {
        toast.success(result.message || `Exported successfully to ${filePath}`);
        onClose();
      } else {
        toast.error("Export failed");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    { value: "csv", label: "CSV", icon: FileText, description: "Comma-separated values" },
    { value: "json", label: "JSON", icon: FileJson, description: "JavaScript Object Notation" },
    { value: "excel", label: "Excel", icon: FileSpreadsheet, description: "Microsoft Excel (.xlsx)" },
    { value: "sqldump", label: "SQL Dump", icon: Database, description: "Database backup script" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export {tableName ? `"${tableName}"` : "Database"}
          </DialogTitle>
          <DialogDescription>
            Choose the export format and options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              className="grid grid-cols-2 gap-3"
            >
              {formatOptions.map((opt) => (
                <div key={opt.value}>
                  <RadioGroupItem
                    value={opt.value}
                    id={opt.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={opt.value}
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <opt.icon className="mb-2 h-6 w-6" />
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {format === "csv" && (
            <div className="space-y-3">
              <Label>CSV Options</Label>
              <div className="flex items-center gap-4">
                <Label htmlFor="delimiter" className="text-sm text-muted-foreground">
                  Delimiter:
                </Label>
                <Input
                  id="delimiter"
                  value={options.delimiter}
                  onChange={(e) => setOptions({ ...options, delimiter: e.target.value })}
                  className="w-16"
                  maxLength={1}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="headers"
                  checked={options.includeHeaders}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, includeHeaders: checked as boolean })
                  }
                />
                <Label htmlFor="headers" className="text-sm">Include headers</Label>
              </div>
            </div>
          )}

          {format === "json" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pretty"
                checked={options.prettyPrint}
                onCheckedChange={(checked) => 
                  setOptions({ ...options, prettyPrint: checked as boolean })
                }
              />
              <Label htmlFor="pretty" className="text-sm">Pretty print (formatted JSON)</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
