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
    description: 'Direct execution for simple tasks',
  },
  deep: {
    label: 'Planning', // Renamed from "Deep" to match reference "Planning" implied context
    description: 'Deep reasoning & planning before execution',
  },
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  
  // Map "deep" mode to "Planning" label for UI, but keep internal state as 'deep'
  const currentLabel = mode === 'deep' ? 'Planning' : 'Fast';

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
          Conversation mode
        </DropdownMenuLabel>
        
        <DropdownMenuItem
          onClick={() => {
            onChange('deep');
            setOpen(false);
          }}
          className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer focus:bg-accent focus:text-accent-foreground"
        >
          <div className="font-medium text-xs">Planning</div>
          <div className="text-[10px] text-muted-foreground leading-tight">
            Agent can plan before executing tasks. Use for deep research.
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
            Agent will execute tasks directly. Quicker response time.
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
