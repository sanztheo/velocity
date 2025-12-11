// ModelSelector Component
// Dropdown to select between AI Providers (Grok, OpenAI, Gemini)

import { useState } from 'react';
import { Bot, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AIProvider } from './types';
import { useAISettingsStore } from './ai-settings.store';

interface ModelSelectorProps {
  provider: AIProvider;
  onChange: (provider: AIProvider) => void;
}

const PROVIDER_CONFIG = {
  grok: {
    label: 'Grok 3 (Beta)',
    description: 'Fastest reasoning & performance',
  },
  openai: {
    label: 'GPT-4o',
    description: 'Reliable general intelligence',
  },
  gemini: {
    label: 'Gemini 2.0 Flash',
    description: 'Large context & speed',
  },
};

export function ModelSelector({ provider, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const settings = useAISettingsStore();
  const { envKeysStatus, grokApiKey, openaiApiKey, geminiApiKey } = settings;

  // Check availability
  const isGrokAvailable = !!(grokApiKey || envKeysStatus?.grokAvailable);
  const isOpenAiAvailable = !!(openaiApiKey || envKeysStatus?.openaiAvailable);
  const isGeminiAvailable = !!(geminiApiKey || envKeysStatus?.geminiAvailable);

  const currentConfig = PROVIDER_CONFIG[provider];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8">
          <Bot className="h-3.5 w-3.5" />
          <span className="text-sm">{currentConfig.label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wider">
          Select Model
        </DropdownMenuLabel>
        
        <DropdownMenuItem
          disabled={!isGrokAvailable}
          onClick={() => {
            onChange('grok');
            setOpen(false);
          }}
          className="flex flex-col items-start gap-1 py-3 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`font-medium ${provider === 'grok' ? 'text-primary' : ''}`}>
              {PROVIDER_CONFIG.grok.label}
            </span>
            {provider === 'grok' && <Check className="h-3 w-3 text-primary" />}
          </div>
          <span className="text-xs text-muted-foreground">
            {PROVIDER_CONFIG.grok.description}
          </span>
          {!isGrokAvailable && (
            <span className="text-[10px] text-destructive mt-1 font-medium">
              Key not configured
            </span>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={!isOpenAiAvailable}
          onClick={() => {
            onChange('openai');
            setOpen(false);
          }}
          className="flex flex-col items-start gap-1 py-3 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`font-medium ${provider === 'openai' ? 'text-primary' : ''}`}>
              {PROVIDER_CONFIG.openai.label}
            </span>
            {provider === 'openai' && <Check className="h-3 w-3 text-primary" />}
          </div>
          <span className="text-xs text-muted-foreground">
            {PROVIDER_CONFIG.openai.description}
          </span>
          {!isOpenAiAvailable && (
            <span className="text-[10px] text-destructive mt-1 font-medium">
              Key not configured
            </span>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={!isGeminiAvailable}
          onClick={() => {
            onChange('gemini');
            setOpen(false);
          }}
          className="flex flex-col items-start gap-1 py-3 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`font-medium ${provider === 'gemini' ? 'text-primary' : ''}`}>
              {PROVIDER_CONFIG.gemini.label}
            </span>
            {provider === 'gemini' && <Check className="h-3 w-3 text-primary" />}
          </div>
          <span className="text-xs text-muted-foreground">
            {PROVIDER_CONFIG.gemini.description}
          </span>
          {!isGeminiAvailable && (
            <span className="text-[10px] text-destructive mt-1 font-medium">
              Key not configured
            </span>
          )}
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
