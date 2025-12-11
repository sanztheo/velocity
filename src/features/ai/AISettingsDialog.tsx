// AI Settings Dialog
// Modal for configuring API keys and AI preferences

import { useState } from 'react';
import { Eye, EyeOff, Key, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAISettingsStore } from './ai-settings.store';

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({ open, onOpenChange }: AISettingsDialogProps) {
  const settings = useAISettingsStore();
  const [showKeys, setShowKeys] = useState({
    grok: false,
    openai: false,
    gemini: false,
  });

  // Local state for inputs
  const [grokKey, setGrokKey] = useState(settings.grokApiKey || '');
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey || '');
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || '');

  const handleSave = () => {
    settings.setGrokApiKey(grokKey);
    settings.setOpenaiApiKey(openaiKey);
    settings.setGeminiApiKey(geminiKey);
    onOpenChange(false);
  };

  const toggleShow = (key: 'grok' | 'openai' | 'gemini') => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const ProviderStatus = ({ hasKey }: { hasKey: boolean }) => (
    hasKey ? (
      <Badge variant="default" className="gap-1 bg-green-500/20 text-green-500 hover:bg-green-500/30">
        <Check className="h-3 w-3" />
        Configured
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <X className="h-3 w-3" />
        Not set
      </Badge>
    )
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            AI Provider Settings
          </DialogTitle>
          <DialogDescription>
            Configure API keys for AI providers. Grok is preferred, others serve as fallbacks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Grok (xAI) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="grok-key" className="flex items-center gap-2">
                <span className="font-semibold">Grok (xAI)</span>
                <Badge variant="outline" className="text-xs">Preferred</Badge>
              </Label>
              <ProviderStatus hasKey={!!grokKey} />
            </div>
            <div className="flex gap-2">
              <Input
                id="grok-key"
                type={showKeys.grok ? 'text' : 'password'}
                placeholder="xai-..."
                value={grokKey}
                onChange={(e) => setGrokKey(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleShow('grok')}
              >
                {showKeys.grok ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get an API key from{' '}
              <a href="https://x.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                x.ai
              </a>
            </p>
          </div>

          {/* OpenAI */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="openai-key" className="font-semibold">OpenAI</Label>
              <ProviderStatus hasKey={!!openaiKey} />
            </div>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type={showKeys.openai ? 'text' : 'password'}
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleShow('openai')}
              >
                {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get an API key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                platform.openai.com
              </a>
            </p>
          </div>

          {/* Gemini */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="gemini-key" className="font-semibold">Gemini</Label>
              <ProviderStatus hasKey={!!geminiKey} />
            </div>
            <div className="flex gap-2">
              <Input
                id="gemini-key"
                type={showKeys.gemini ? 'text' : 'password'}
                placeholder="AIza..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleShow('gemini')}
              >
                {showKeys.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get an API key from{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                aistudio.google.com
              </a>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
