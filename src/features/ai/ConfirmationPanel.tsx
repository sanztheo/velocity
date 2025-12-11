// ConfirmationPanel Component
// Human-in-the-loop SQL approval interface

import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PendingSqlConfirmation } from './types';

interface ConfirmationPanelProps {
  confirmation: PendingSqlConfirmation;
  onConfirm: () => void;
  onReject: (reason: string) => void;
}

export function ConfirmationPanel({ confirmation, onConfirm, onReject }: ConfirmationPanelProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      await onConfirm();
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReject = () => {
    onReject(rejectReason || 'User rejected without providing a reason');
    setRejectReason('');
  };

  return (
    <div className="border-t p-4 bg-yellow-500/10 border-yellow-500/30">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">SQL Execution Pending</p>
          <p className="text-sm text-muted-foreground">
            {confirmation.isMutation 
              ? 'This query will modify data. Review carefully before executing.'
              : 'Review the query before execution.'}
          </p>
        </div>
      </div>

      <pre className="bg-muted p-3 rounded text-sm font-mono mb-3 overflow-x-auto whitespace-pre-wrap break-all">
        {confirmation.sql}
      </pre>

      <div className="flex gap-2 flex-wrap">
        <Button 
          onClick={handleConfirm}
          disabled={isExecuting}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isExecuting ? (
            <>Executing...</>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-1" />
              Execute
            </>
          )}
        </Button>
        
        <Input
          placeholder="Reason for rejection (optional)..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          className="flex-1 min-w-[200px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleReject();
            }
          }}
        />
        
        <Button 
          variant="destructive"
          onClick={handleReject}
          disabled={isExecuting}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}
