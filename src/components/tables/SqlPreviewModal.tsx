import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, X, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SqlPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sql: string;
  changeCount: number;
  isExecuting: boolean;
}

export function SqlPreviewModal({
  open,
  onClose,
  onConfirm,
  sql,
  changeCount,
  isExecuting,
}: SqlPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    toast.success('SQL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Review Changes Before Commit
          </DialogTitle>
          <DialogDescription>
            The following SQL will be executed. Please review carefully.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <Badge variant="outline" className="text-xs">
            {changeCount} change{changeCount !== 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="ml-auto"
          >
            {copied ? (
              <Check className="h-4 w-4 mr-1" />
            ) : (
              <Copy className="h-4 w-4 mr-1" />
            )}
            {copied ? 'Copied!' : 'Copy SQL'}
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-secondary/50 rounded-lg p-4 border border-border">
          <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
            {sql.split('\n').map((line, i) => {
              let className = '';
              if (line.startsWith('UPDATE')) className = 'text-blue-400';
              else if (line.startsWith('INSERT')) className = 'text-green-400';
              else if (line.startsWith('DELETE')) className = 'text-red-400';
              else if (line.startsWith('--')) className = 'text-muted-foreground';
              else if (line.startsWith('BEGIN') || line.startsWith('COMMIT')) className = 'text-purple-400';
              
              return (
                <div key={i} className={className}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isExecuting}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isExecuting}>
            {isExecuting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Executing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Commit Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
