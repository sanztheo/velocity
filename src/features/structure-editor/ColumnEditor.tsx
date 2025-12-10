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
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card/50 hover:bg-muted/30 transition-colors">
      <div className="grid gap-4 flex-1 grid-cols-[2fr,1.5fr,auto,1.5fr]">
        <Input
          value={column.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Column Name"
          className=""
        />
        
        <Select 
          value={column.dataType} 
          onValueChange={(v) => onChange({ dataType: v })}
        >
          <SelectTrigger className="">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-4 px-2 border-x border-border/50 bg-background/50 rounded-md">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary transition-colors" title="Allow Null values">
            <Checkbox 
              checked={column.nullable} 
              onCheckedChange={(c) => onChange({ nullable: c === true })} 
            />
            <span className="opacity-80">Nullable</span>
          </label>
          
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary transition-colors" title="Primary Key">
            <Checkbox 
              checked={column.isPrimaryKey} 
              onCheckedChange={(c) => onChange({ isPrimaryKey: c === true })} 
            />
             <span className="opacity-80">PK</span>
          </label>
          
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary transition-colors" title="Auto Increment">
            <Checkbox 
              checked={column.isAutoIncrement} 
              onCheckedChange={(c) => onChange({ isAutoIncrement: c === true })} 
            />
             <span className="opacity-80">AI</span>
          </label>
        </div>

        <Input
          value={column.defaultValue || ''}
          onChange={(e) => onChange({ defaultValue: e.target.value || undefined })}
          placeholder="Default Value"
          className=""
        />
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
