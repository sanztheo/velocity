import { usePerformanceStore } from '@/stores/performanceStore';
import { Activity, Database, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function PerformanceMonitor() {
  const { lastQueryDuration, lastRowCount, queryCount, isError, lastErrorMessage } = usePerformanceStore();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-show when a query happens
  useEffect(() => {
    if (queryCount > 0) {
      setIsVisible(true);
      // Auto-hide error details after a while if desired, but keeping basic stats visible is better
    }
  }, [queryCount]);

  if (!isVisible) return null;

  // Color coding based on duration
  const getDurationColor = (ms: number) => {
    if (ms < 100) return 'text-green-500';
    if (ms < 500) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 text-xs font-mono">
       {/* Detailed error view if expanded */}
       {isExpanded && isError && lastErrorMessage && (
         <div className="bg-destructive/90 text-destructive-foreground p-3 rounded-md shadow-lg max-w-[300px] animate-in slide-in-from-bottom-2">
           <div className="font-bold flex items-center gap-2 mb-1">
             <AlertCircle className="h-4 w-4" /> Error
           </div>
           <div className="break-words opacity-90">{lastErrorMessage}</div>
         </div>
       )}

      {/* Main Stats Pill */}
      <div 
        className={cn(
          "flex items-center gap-4 px-3 py-2 rounded-full shadow-lg border backdrop-blur-md transition-all cursor-pointer select-none",
          isError ? "bg-destructive/10 border-destructive/50" : "bg-background/80 border-border hover:bg-background"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5" title="Execution Time">
          <Clock className={cn("h-3.5 w-3.5", getDurationColor(lastQueryDuration))} />
          <span className={cn("font-bold", getDurationColor(lastQueryDuration))}>
            {lastQueryDuration >= 1000 ? (lastQueryDuration / 1000).toFixed(2) + 's' : lastQueryDuration.toFixed(0) + 'ms'}
          </span>
        </div>

        <div className="h-3 w-px bg-border" />

        <div className="flex items-center gap-1.5 text-muted-foreground" title="Rows Fetched">
          <Database className="h-3.5 w-3.5" />
          <span>{lastRowCount.toLocaleString()} rows</span>
        </div>

        <div className="h-3 w-px bg-border" />

        <div className="flex items-center gap-1.5 text-muted-foreground" title="Total Queries">
           <Activity className="h-3.5 w-3.5" />
           <span>{queryCount}</span>
        </div>
      </div>
    </div>
  );
}
