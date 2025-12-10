import { useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchemaEditor } from "./useSchemaEditor";
import { ColumnList } from "./ColumnList";
import { CodeMirrorEditor } from "../sql-editor/CodeMirrorEditor";
import { Loader2 } from "lucide-react";

interface CreateTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  onTableCreated?: () => void;
}

export function CreateTableDialog({ 
  isOpen, 
  onClose, 
  connectionId,
  onTableCreated 
}: CreateTableDialogProps) {
  const {
    tableName,
    setTableName,
    columns,
    addColumn,
    removeColumn,
    updateColumn,
    sqlPreview,
    generateCreatePreview,
    executeChanges,
    isPreviewLoading,
    isExecuting
  } = useSchemaEditor(connectionId);

  // Auto-generate preview when significant changes occur
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tableName && columns.length > 0) {
        generateCreatePreview();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [tableName, columns, generateCreatePreview]);

  const handleCreate = async () => {
    const success = await executeChanges();
    if (success) {
      onTableCreated?.();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Define table structure. SQL will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="table-name">Table Name</Label>
            <Input
              id="table-name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. users"
              className="w-1/3"
            />
          </div>

          <div className="flex-1 border rounded-md p-4 overflow-hidden flex flex-col">
            <ColumnList
              columns={columns}
              onAdd={addColumn}
              onRemove={removeColumn}
              onUpdate={updateColumn}
            />
          </div>

          <div className="h-[150px] border rounded-md overflow-hidden flex flex-col">
            <div className="bg-secondary/50 px-4 py-2 text-xs font-mono border-b flex justify-between items-center">
              <span>SQL Preview</span>
              {isPreviewLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <div className="flex-1 relative">
               <CodeMirrorEditor
                  value={sqlPreview}
                  onChange={() => {}} // Read-only preview mostly
                  readOnly={true}
                  height="100%"
               />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExecuting}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!tableName || columns.length === 0 || !sqlPreview || isExecuting}
          >
            {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
