// ChatInput Component
// Input area for sending messages to the AI
// Redesigned with integrated Mode and Model selectors

import { useRef, useEffect } from 'react';
import { Send, StopCircle } from 'lucide-react';
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
  // New props for selectors
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
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
    <div className="p-4 bg-background">
      <div className={cn(
        "flex flex-col border rounded-xl bg-background shadow-sm transition-all",
        "focus-within:ring-1 focus-within:ring-ring focus-within:border-ring/50"
      )}>
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b/50">
          <ModeSelector mode={mode} onChange={onModeChange} />
          <div className="h-4 w-px bg-border mx-1" />
          <ModelSelector provider={provider} onChange={onProviderChange} />
        </div>

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
              "w-full resize-none bg-transparent px-4 py-3 pb-12",
              "placeholder:text-muted-foreground focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[60px] max-h-[300px]"
            )}
          />

          {/* Footer Actions */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground mr-2 font-medium opacity-70 hidden sm:inline-block">
              Use Shift + Return for new line
            </span>
            
            {isLoading ? (
              <Button
                onClick={onStop}
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-lg transition-all",
                  value.trim() ? "opacity-100" : "opacity-50"
                )}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Disclaimer / Footer */}
      <div className="flex justify-center mt-2">
         <p className="text-[10px] text-muted-foreground/60 text-center">
            AI can make mistakes. Please double check results.
         </p>
      </div>
    </div>
  );
}
