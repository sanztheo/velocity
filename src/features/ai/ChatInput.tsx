// ChatInput Component
// Input area for sending messages to the AI with @ mention support

import { useRef, useEffect, useState, useCallback } from 'react';
import { StopCircle, Plus, ArrowRight, X, Table as TableIcon, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  className?: string;
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
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);

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
    <div className={cn("flex flex-col gap-0 w-full p-2 pt-0 pb-2", className)}>
      {/* Mention Dropdown */}
      {mentions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {mentions.map((mention, index) => (
              <Badge 
                key={index}
                variant="secondary"
                className="flex items-center gap-1 bg-muted/50 hover:bg-muted text-xs font-normal"
              >
                {mention.type === 'table' ? <TableIcon className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {mention.value}
                <div
                  role="button"
                  tabIndex={0}
                  className="ml-1 cursor-pointer hover:text-foreground pointer-events-auto flex items-center justify-center p-0.5 rounded-full hover:bg-background/20" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMention(mention.value);
                  }}
                  onKeyDown={(e) => {
                     if(e.key === "Enter" || e.key === " "){
                         e.preventDefault();
                         e.stopPropagation();
                         onRemoveMention(mention.value);
                     }
                  }}
                >
                  <X className="h-3 w-3" />
                </div>
              </Badge>
            ))}
          </div>
      )}

      {/* Main Input Container - Matching the 'design.html' structure (Row Layout) */}
      <div className={cn(
        "group flex flex-col rounded-lg border bg-muted/30 transition-all duration-200 p-2",
        isFocused ? "border-primary/50 bg-muted/40 shadow-sm" : "border-border",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}>
        
        <div className="flex flex-row items-end gap-2">
          {/* Left Column: Input + Toolbar */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={disabled || isLoading} // Keep isLoading for disabling
                rows={1}
                className="w-full resize-none bg-transparent px-2 py-1 sm:text-sm text-[13px] placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] max-h-[300px]"
                style={{ minHeight: '48px' }}
              />
              
              {/* Mention Dropdown Positioned relative to textarea */}
              <MentionDropdown
                isOpen={showMentionDropdown}
                searchQuery={mentionQuery}
                tables={availableTables}
                onSelect={handleSelectMention}
                onClose={() => setShowMentionDropdown(false)}
                selectedIndex={selectedIndex}
              />
            </div>

            {/* Bottom Toolbar (Inside Left Column) */}
            <div className="flex w-full items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md opacity-60 hover:bg-muted-foreground/10 hover:opacity-100 shrink-0"
                    onClick={() => {
                        onChange(value + '@');
                        textareaRef.current?.focus();
                    }}
                    title="Add context (@)"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  <ModeSelector mode={mode} onChange={onModeChange} />
                  <ModelSelector provider={provider} mode={mode} onChange={onProviderChange} />
                  
                  {/* Auto-Run Toggle */}
                  <div className="hidden sm:flex items-center gap-1.5 ml-1 pl-1 border-l border-border/40">
                     <Switch 
                        id="auto-run" 
                        checked={autoAccept} 
                        onCheckedChange={onAutoAcceptChange}
                        className="h-3.5 w-6 data-[state=checked]:bg-primary/50"
                     />
                     <label htmlFor="auto-run" className="text-[10px] text-muted-foreground cursor-pointer select-none">Auto-run</label>
                  </div>
                </div>
            </div>
          </div>

          {/* Right Column: Send Button */}
          <div className="shrink-0">
             <Button 
                onClick={isLoading ? onStop : onSubmit}
                disabled={(!value.trim() && !isLoading) || disabled}
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full shadow-sm transition-all",
                  isLoading 
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                  (!value.trim() && !isLoading) && "opacity-50 bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {isLoading ? (
                  <StopCircle className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4 stroke-[2]" />
                )}
              </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
