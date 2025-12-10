import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { ColumnDefinition } from "./types";

interface ColumnEditorProps {
  column: ColumnDefinition;
  onChange: (updates: Partial<ColumnDefinition>) => void;
  onRemove: () => void;
}

const COMMON_TYPES = [
  'VARCHAR', 'TEXT', 
  'INT', 'BIGINT', 
  'BOOLEAN', 
  'DATE', 'TIMESTAMP', 
  'DECIMAL', 'FLOAT'
];

export function ColumnEditor({ column, onChange, onRemove }: ColumnEditorProps) {
  return (
    <div className="flex items-center gap-2 mb-2 p-2 rounded-md hover:bg-muted/50">
      <Input
        value={column.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Column Name"
        className="w-[200px] h-8"
      />
      
      <Select 
        value={column.dataType} 
        onValueChange={(v) => onChange({ dataType: v })}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {COMMON_TYPES.map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <div className="flex items-center gap-4 px-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox 
            checked={column.nullable} 
            onCheckedChange={(c) => onChange({ nullable: c === true })} 
          />
          Nullable
        </label>
        
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox 
            checked={column.isPrimaryKey} 
            onCheckedChange={(c) => onChange({ isPrimaryKey: c === true })} 
          />
          PK
        </label>
        
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox 
            checked={column.isAutoIncrement} 
            onCheckedChange={(c) => onChange({ isAutoIncrement: c === true })} 
          />
          AI
        </label>
      </div>

      <Input
        value={column.defaultValue || ''}
        onChange={(e) => onChange({ defaultValue: e.target.value || undefined })}
        placeholder="Default Value"
        className="w-[140px] h-8 ml-auto"
      />
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
