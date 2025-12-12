// ModelSelector Component
// Dropdown to select between AI Providers
// Styled to match IDE-style reference (minimal text + chevron)

import { useState } from 'react';
import { ChevronUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { AgentMode, AIProvider } from './types';
import { useAISettingsStore } from './ai-settings.store';

interface ModelSelectorProps {
  provider: AIProvider;
  mode: AgentMode;
  onChange: (provider: AIProvider) => void;
}

const getProviderConfig = (mode: AgentMode) => ({
  grok: {
    label: mode === 'deep' ? 'Grok 3 Mini' : 'Grok 4.1 Fast',
    description: mode === 'deep' ? 'Visible reasoning step-by-step' : 'Fastest reasoning & performance',
  },
  openai: {
    label: mode === 'deep' ? 'o1-mini' : 'GPT-4o',
    description: mode === 'deep' ? 'Complex reasoning model' : 'Reliable general intelligence',
  },
  gemini: {
    label: mode === 'deep' ? 'Gemini 2.5 Flash Preview' : 'Gemini 2.0 Flash',
    description: mode === 'deep' ? 'Experimental thinking model' : 'Large context & speed',
  },
});

export function ModelSelector({ provider, mode, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const settings = useAISettingsStore();
  const { envKeysStatus, grokApiKey, openaiApiKey, geminiApiKey } = settings;

  // Check availability
  const isGrokAvailable = !!(grokApiKey || envKeysStatus?.grokAvailable);
  const isOpenAiAvailable = !!(openaiApiKey || envKeysStatus?.openaiAvailable);
  const isGeminiAvailable = !!(geminiApiKey || envKeysStatus?.geminiAvailable);

  const providerConfig = getProviderConfig(mode);
  const currentConfig = providerConfig[provider];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 px-1.5 gap-0.5 rounded-md hover:bg-muted/50 opacity-70 hover:opacity-100 font-normal max-w-[160px]"
        >
          <ChevronUp className="h-3.5 w-3.5 stroke-1 shrink-0" />
          <p className="text-xs select-none truncate">{currentConfig.label}</p>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" side="top" sideOffset={8}>
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 pb-1">
          Select Model
        </DropdownMenuLabel>
        
        {Object.entries(providerConfig).map(([key, config]) => {
          const providerKey = key as AIProvider;
          const isAvailable = 
            providerKey === 'grok' ? isGrokAvailable :
            providerKey === 'openai' ? isOpenAiAvailable :
            providerKey === 'gemini' ? isGeminiAvailable : false;

          return (
            <DropdownMenuItem
              key={key}
              disabled={!isAvailable}
              onClick={() => {
                onChange(providerKey);
                setOpen(false);
              }}
              className="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer focus:bg-accent focus:text-accent-foreground"
            >
              <div className="flex items-center justify-between w-full">
                <span className={`font-medium text-xs ${provider === providerKey ? 'text-primary' : ''}`}>
                  {config.label}
                </span>
                {provider === providerKey && <Check className="h-3 w-3 text-primary" />}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {config.description}
              </div>
              {!isAvailable && (
                <span className="text-[9px] text-destructive mt-0.5 font-medium">
                  Key not configured
                </span>
              )}
            </DropdownMenuItem>
          );
        })}

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
