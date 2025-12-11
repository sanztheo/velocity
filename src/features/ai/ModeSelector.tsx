// ModeSelector Component
// Toggle between FAST and DEEP AI modes

import { Zap, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentMode } from './types';

interface ModeSelectorProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      <button
        onClick={() => onChange('fast')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          mode === 'fast'
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        Fast
      </button>
      <button
        onClick={() => onChange('deep')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          mode === 'deep'
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Brain className="h-3.5 w-3.5" />
        Deep
      </button>
    </div>
  );
}
