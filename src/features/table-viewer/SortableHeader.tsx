import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SortDirection } from './types';

interface SortableHeaderProps {
  column: string;
  label?: string;
  currentSort: { column: string; direction: SortDirection } | null;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableHeader({
  column,
  label,
  currentSort,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort?.column === column;
  const direction = isActive ? currentSort.direction : null;

  return (
    <button
      onClick={() => onSort(column)}
      className={cn(
        "flex items-center gap-1 px-3 py-2 text-left font-medium text-muted-foreground",
        "hover:text-foreground hover:bg-secondary/50 transition-colors",
        "border-b border-border whitespace-nowrap w-full",
        isActive && "text-foreground",
        className
      )}
    >
      <span>{label || column}</span>
      <span>{direction === 'asc' ? (
          <ChevronUp className="h-4 w-4 text-primary" />
        ) : direction === 'desc' ? (
          <ChevronDown className="h-4 w-4 text-primary" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </button>
  );
}
