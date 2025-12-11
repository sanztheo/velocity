// ModeSelector Component
// Toggle between Fast and Deep thinking modes
// Styled to match IDE-style reference (minimal pill)

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AgentMode } from './types';

interface ModeSelectorProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
}

const MODES = {
  fast: {
    label: 'Fast',
    description: 'Quick responses, single-step execution',
  },
  deep: {
    label: 'Deep',
    description: 'Extended thinking with multi-step reasoning',
  },
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const currentLabel = MODES[mode].label;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-1.5 gap-0.5 rounded-md hover:bg-muted/50 opacity-70 hover:opacity-100 font-normal"
        >
          <ChevronUp className="h-3.5 w-3.5 stroke-1" />
          <span className="text-xs select-none">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" side="top" sideOffset={8}>
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 pb-1">
          Agent mode
        </DropdownMenuLabel>
        
        <DropdownMenuItem
          onClick={() => {
            onChange('deep');
            setOpen(false);
          }}
          className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer focus:bg-accent focus:text-accent-foreground"
        >
          <div className="font-medium text-xs">Deep</div>
          <div className="text-[10px] text-muted-foreground leading-tight">
            Extended thinking with chain-of-thought reasoning. Slower but thorough.
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => {
            onChange('fast');
            setOpen(false);
          }}
          className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer focus:bg-accent focus:text-accent-foreground"
        >
          <div className="font-medium text-xs">Fast</div>
          <div className="text-[10px] text-muted-foreground leading-tight">
            Quick responses for simple tasks. Single-step execution.
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
