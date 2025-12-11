// ThinkingProcess Component
// Collapsible display for AI reasoning/thinking blocks

import { useState } from 'react';
import { Brain, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingProcessProps {
  content: string;
  defaultOpen?: boolean;
}

export function ThinkingProcess({ content, defaultOpen = false }: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!content) return null;

  return (
    <div className="border rounded-lg mb-3 bg-muted/20 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-3 w-full text-left text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <Brain className="h-4 w-4 text-purple-500" />
        <span className="font-medium">Thinking...</span>
        <ChevronDown 
          className={cn(
            "h-4 w-4 ml-auto transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-3 pt-0 text-sm text-muted-foreground whitespace-pre-wrap border-t border-border/50">
          {content}
        </div>
      )}
    </div>
  );
}
