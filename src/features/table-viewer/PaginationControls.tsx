import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaginationControlsProps {
  page: number;
  limit: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  className?: string;
}

export function PaginationControls({
  page,
  limit,
  totalCount,
  onPageChange,
  onLimitChange,
  className,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(totalCount / limit);
  const startRow = page * limit + 1;
  const endRow = Math.min((page + 1) * limit, totalCount);

  const limitOptions = [25, 50, 100, 250, 500];

  const handlePageInput = (value: string) => {
    const pageNum = parseInt(value, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum - 1);
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 px-3 py-2 bg-secondary/30 border-t border-border text-xs",
      className
    )}>
      {/* Row count info */}
      <div className="text-muted-foreground">
        {totalCount > 0 ? (
          <>Showing <span className="font-medium text-foreground">{startRow}-{endRow}</span> of <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> rows</>
        ) : (
          'No rows'
        )}
      </div>

      {/* Rows per page */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Rows:</span>
        <Select value={String(limit)} onValueChange={(v) => onLimitChange(parseInt(v, 10))}>
          <SelectTrigger className="w-[70px] h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {limitOptions.map(opt => (
              <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(0)}
          disabled={page === 0}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 mx-2">
          <Input
            value={page + 1}
            onChange={(e) => handlePageInput(e.target.value)}
            className="w-12 h-7 text-xs text-center"
            type="number"
            min={1}
            max={totalPages}
          />
          <span className="text-muted-foreground">of {totalPages || 1}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
