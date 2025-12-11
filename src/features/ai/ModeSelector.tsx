// ModeSelector Component
// Dropdown to select between FAST and DEEP AI modes

import { useState } from 'react';
import { Zap, Brain, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AgentMode } from './types';

interface ModeSelectorProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
}

const MODE_CONFIG = {
  fast: {
    icon: Zap,
    label: 'Fast',
    description: 'Execute tasks directly. Use for simple queries.',
  },
  deep: {
    icon: Brain,
    label: 'Deep',
    description: 'Think step by step. Use for complex analysis.',
  },
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentConfig = MODE_CONFIG[mode];
  const CurrentIcon = currentConfig.icon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8">
          <CurrentIcon className="h-3.5 w-3.5" />
          <span className="text-sm">{currentConfig.label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {(Object.keys(MODE_CONFIG) as AgentMode[]).map((modeKey) => {
          const config = MODE_CONFIG[modeKey];
          const Icon = config.icon;
          const isSelected = mode === modeKey;
          
          return (
            <DropdownMenuItem
              key={modeKey}
              onClick={() => {
                onChange(modeKey);
                setOpen(false);
              }}
              className="flex flex-col items-start gap-1 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : ''}`} />
                <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                  {config.label}
                </span>
              </div>
              <span className="text-xs text-muted-foreground pl-6">
                {config.description}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
