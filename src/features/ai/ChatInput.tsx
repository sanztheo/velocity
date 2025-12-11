// ChatInput Component
// Input area for sending messages to the AI
// Redesigned to match specific user reference (IDE-style)

import { useRef, useEffect } from 'react';
import { Send, StopCircle, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ModeSelector } from './ModeSelector';
import { ModelSelector } from './ModelSelector';
import type { AgentMode, AIProvider } from './types';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  disabled,
  placeholder = "Ask about your database...",
  mode,
  onModeChange,
  provider,
  onProviderChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || disabled || isLoading) return;
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-background border-t">
      <div className={cn(
        "flex flex-col gap-0 rounded-lg border border-border/50 bg-muted/20 p-2",
        "focus-within:ring-1 focus-within:ring-ring/50 focus-within:border-ring/50 transition-all duration-200"
      )}>
        
        {/* Input Area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent px-2 py-2",
              "placeholder:text-muted-foreground/50 focus:outline-none text-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[48px] max-h-[300px]"
            )}
            style={{ minHeight: '48px' }}
          />
        </div>

        {/* Bottom Toolbar */}
        <div className="flex w-full items-center justify-between gap-1 px-0.5 mt-1">
          <div className="flex min-w-0 items-center gap-1">
            
            {/* Context Add Button (Mock functionality for now to match design) */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 rounded-full opacity-70 hover:bg-muted/50 hover:opacity-100"
              title="Add context"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>

            {/* Mode Selector */}
            <ModeSelector mode={mode} onChange={onModeChange} />

            {/* Model Selector */}
            <ModelSelector provider={provider} onChange={onProviderChange} />
            
          </div>

          {/* Send/Stop Button */}
          <div className="shrink-0">
            {isLoading ? (
              <Button
                onClick={onStop}
                variant="destructive"
                size="icon"
                className="h-7 w-7 rounded-lg transition-all"
              >
                <StopCircle className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-lg transition-all shadow-sm",
                  value.trim() 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-50"
                )}
              >
                <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
