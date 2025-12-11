// ChatInput Component
// Input area for sending messages to the AI with @ mention support

import { useRef, useEffect, useState, useCallback } from 'react';
import { StopCircle, Plus, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ModeSelector } from './ModeSelector';
import { ModelSelector } from './ModelSelector';
import { MentionDropdown } from './MentionDropdown';
import type { AgentMode, AIProvider } from './types';
import type { Mention } from './useMentions';

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
  autoAccept: boolean;
  onAutoAcceptChange: (value: boolean) => void;
  // Mentions
  mentions: Mention[];
  onAddMention: (mention: Mention) => void;
  onRemoveMention: (value: string) => void;
  availableTables: string[];
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  disabled,
  placeholder = "Ask about your database... (@ to mention)",
  mode,
  onModeChange,
  provider,
  onProviderChange,
  autoAccept,
  onAutoAcceptChange,
  mentions,
  onAddMention,
  onRemoveMention,
  availableTables,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  }, [value]);

  // Handle @ mention detection
  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue);
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);
    
    // Check for @ trigger
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentionDropdown(true);
      setMentionQuery(atMatch[1]);
      setMentionStartPos(cursorPos - atMatch[0].length);
      setSelectedIndex(0);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
      setMentionStartPos(null);
    }
  }, [onChange]);

  // Handle mention selection
  const handleSelectMention = useCallback((mention: Mention) => {
    if (mentionStartPos !== null) {
      // Replace @query with nothing (mention is shown as chip)
      const beforeAt = value.slice(0, mentionStartPos);
      const afterQuery = value.slice(mentionStartPos + mentionQuery.length + 1);
      onChange(beforeAt + afterQuery);
    }
    
    onAddMention(mention);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartPos(null);
    
    // Focus back on textarea
    textareaRef.current?.focus();
  }, [mentionStartPos, mentionQuery, value, onChange, onAddMention]);

  const handleSubmit = () => {
    if (!value.trim() || disabled || isLoading) return;
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown) {
      // Handle arrow keys for dropdown navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => prev + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        // Select current option - handled by dropdown
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
      }
      return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-background border-t">
      <div className={cn(
        "flex flex-col gap-0 rounded-xl border border-border/50 bg-muted/20 p-3",
        "focus-within:ring-1 focus-within:ring-ring/50 focus-within:border-ring/50 transition-all duration-200"
      )}>
        
        {/* Mention Chips */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {mentions.map(mention => (
              <div
                key={`${mention.type}-${mention.value}`}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                  mention.type === 'web' 
                    ? "bg-blue-500/10 text-blue-500" 
                    : "bg-primary/10 text-primary"
                )}
              >
                <span>{mention.displayName}</span>
                <button
                  onClick={() => onRemoveMention(mention.value)}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent px-1 py-1 sm:text-sm text-[13px]",
              "placeholder:text-muted-foreground/50 focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[48px] max-h-[300px] pb-3" 
            )}
            style={{ minHeight: '48px' }}
          />
          
          {/* Mention Dropdown */}
          <MentionDropdown
            isOpen={showMentionDropdown}
            searchQuery={mentionQuery}
            tables={availableTables}
            onSelect={handleSelectMention}
            onClose={() => setShowMentionDropdown(false)}
            selectedIndex={selectedIndex}
          />
        </div>

        <div className="flex w-full items-center justify-between gap-2 mt-0">
          <div className="flex min-w-0 items-center gap-0.5">
            
            {/* Context Add Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-lg opacity-70 hover:bg-muted/50 hover:opacity-100 shrink-0"
              title="Add context (@)"
              onClick={() => {
                onChange(value + '@');
                textareaRef.current?.focus();
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* Mode Selector */}
            <ModeSelector mode={mode} onChange={onModeChange} />

            {/* Model Selector */}
            <ModelSelector provider={provider} onChange={onProviderChange} />
            
            <div className="w-px h-4 bg-border/50 mx-1 shrink-0" />

            {/* Auto-Accept Toggle */}
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => onAutoAcceptChange(!autoAccept)}
              className={cn(
                "h-7 px-2 text-[11px] gap-1.5 font-medium rounded-lg transition-colors shrink-0",
                autoAccept 
                  ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                  : "text-muted-foreground hover:bg-muted/50"
              )}
              title={autoAccept ? "Auto-execute SQL (Dangerous)" : "Ask for confirmation"}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                autoAccept ? "bg-red-500" : "bg-muted-foreground/50"
              )} />
              <span className="truncate">Auto-Run</span>
            </Button>
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
