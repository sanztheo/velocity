import { useState } from 'react';
import { Plus, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  ColumnFilter, 
  FilterOperator, 
  FilterLogic, 
  OPERATOR_LABELS, 
  VALUE_LESS_OPERATORS 
} from './types';

interface FilterBarProps {
  columns: string[];
  filters: ColumnFilter[];
  filterLogic: FilterLogic;
  onAddFilter: (column: string, operator: FilterOperator, value?: unknown) => void;
  onRemoveFilter: (index: number) => void;
  onUpdateFilter: (index: number, updates: Partial<ColumnFilter>) => void;
  onClearFilters: () => void;
  onSetFilterLogic: (logic: FilterLogic) => void;
  className?: string;
}

export function FilterBar({
  columns,
  filters,
  filterLogic,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter: _onUpdateFilter,
  onClearFilters,
  onSetFilterLogic,
  className,
}: FilterBarProps) {
  const [newColumn, setNewColumn] = useState<string>('');
  const [newOperator, setNewOperator] = useState<FilterOperator>('equals');
  const [newValue, setNewValue] = useState('');

  const handleAddFilter = () => {
    if (!newColumn) return;
    
    let value: unknown;
    if (VALUE_LESS_OPERATORS.includes(newOperator)) {
      value = undefined;
    } else if (newOperator === 'in') {
      // Convert comma-separated string to array for IN operator
      value = newValue.split(',').map(v => v.trim()).filter(v => v.length > 0);
    } else {
      value = newValue;
    }
    
    onAddFilter(newColumn, newOperator, value);
    setNewColumn('');
    setNewValue('');
  };

  const operators: FilterOperator[] = ['equals', 'notEquals', 'like', 'in', 'isNull', 'isNotNull', 'greaterThan', 'lessThan'];

  return (
    <div className={cn("flex flex-col gap-2 p-2 bg-secondary/30 border-b border-border", className)}>
      {/* Active filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((filter, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="flex items-center gap-1 px-2 py-1"
            >
              <span className="font-medium">{filter.column}</span>
              <span className="text-muted-foreground">{OPERATOR_LABELS[filter.operator]}</span>
              {!VALUE_LESS_OPERATORS.includes(filter.operator) && (
                <span className="text-primary">{String(filter.value)}</span>
              )}
              <button 
                onClick={() => onRemoveFilter(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
              {index < filters.length - 1 && (
                <button
                  onClick={() => onSetFilterLogic(filterLogic === 'and' ? 'or' : 'and')}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {filterLogic.toUpperCase()}
                </button>
              )}
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Add filter form */}
      <div className="flex items-center gap-2">
        <Select value={newColumn} onValueChange={setNewColumn}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Column..." />
          </SelectTrigger>
          <SelectContent>
            {columns.map(col => (
              <SelectItem key={col} value={col}>{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={newOperator} onValueChange={(v) => setNewOperator(v as FilterOperator)}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map(op => (
              <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!VALUE_LESS_OPERATORS.includes(newOperator) && (
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={newOperator === 'in' ? "val1, val2, val3..." : "Value..."}
            className="w-[150px] h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
          />
        )}

        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleAddFilter}
          disabled={!newColumn}
          className="h-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
