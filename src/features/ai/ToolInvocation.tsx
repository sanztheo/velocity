// ToolInvocation Component
// Displays tool call status, arguments, and results

import { Loader2, CheckCircle, XCircle, Clock, Database, Search, FileCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ToolStatus = 'pending' | 'awaiting-confirmation' | 'executing' | 'success' | 'error';

interface ToolInvocationProps {
  toolName: string;
  args: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  error?: string;
}

const TOOL_ICONS: Record<string, typeof Database> = {
  get_database_schema: Database,
  run_sql_query: FileCode,
  explain_query: Search,
};

const STATUS_CONFIG = {
  pending: {
    icon: Loader2,
    label: 'Pending',
    color: 'text-muted-foreground',
    animate: true,
  },
  'awaiting-confirmation': {
    icon: Clock,
    label: 'Awaiting Confirmation',
    color: 'text-yellow-500',
    animate: false,
  },
  executing: {
    icon: Loader2,
    label: 'Executing',
    color: 'text-blue-500',
    animate: true,
  },
  success: {
    icon: CheckCircle,
    label: 'Success',
    color: 'text-green-500',
    animate: false,
  },
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'text-red-500',
    animate: false,
  },
};

export function ToolInvocation({ toolName, args, status, result, error }: ToolInvocationProps) {
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;
  const ToolIcon = TOOL_ICONS[toolName] || FileCode;

  const formatToolName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const truncateResult = (res: unknown): string => {
    const str = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
    if (str.length > 500) {
      return str.slice(0, 500) + '\n... (truncated)';
    }
    return str;
  };
  const hasArgs = args && Object.keys(args).length > 0;
  const hasResult = status === 'success' && result !== undefined;
  const hasError = status === 'error' && error;

  return (
    <div className="border rounded-lg p-3 mb-3 bg-background/50">
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon 
          className={cn(
            "h-4 w-4",
            statusConfig.color,
            statusConfig.animate && "animate-spin"
          )} 
        />
        <ToolIcon className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="font-mono text-xs">
          {formatToolName(toolName)}
        </Badge>
        <span className={cn("text-xs ml-auto", statusConfig.color)}>
          {statusConfig.label}
        </span>
      </div>

      {/* Arguments */}
      {hasArgs ? (
        <div className="mb-2">
          <span className="text-xs text-muted-foreground block mb-1">Arguments:</span>
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Result */}
      {hasResult ? (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            View Result
          </summary>
          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto font-mono max-h-48 overflow-y-auto">
            {truncateResult(result)}
          </pre>
        </details>
      ) : null}

      {/* Error */}
      {hasError ? (
        <div className="mt-2 text-xs text-red-500 bg-red-500/10 p-2 rounded">
          {error}
        </div>
      ) : null}
    </div>
  );
}
