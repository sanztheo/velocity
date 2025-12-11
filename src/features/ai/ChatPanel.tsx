// ChatPanel Component
// Main AI chat interface container

import { useState, useRef, useEffect } from 'react';
import { Settings, AlertTriangle, Bot, Key } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useVelocityAgent } from './useVelocityAgent';
import { useAISettingsStore } from './ai-settings.store';
import { ModeSelector } from './ModeSelector';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ConfirmationPanel } from './ConfirmationPanel';
import { AISettingsDialog } from './AISettingsDialog';
import type { AgentMode } from './types';

interface ChatPanelProps {
  connectionId: string;
}

export function ChatPanel({ connectionId }: ChatPanelProps) {
  const [mode, setMode] = useState<AgentMode>('fast');
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { autoAcceptSql, setAutoAcceptSql } = useAISettingsStore();

  const agent = useVelocityAgent({ connectionId, mode });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.messages]);

  const handleSubmit = async () => {
    if (!agent.input.trim()) return;
    const input = agent.input;
    agent.setInput('');
    await agent.append({ role: 'user', content: input });
  };

  // No provider configured
  if (!agent.hasProvider) {
    return (
      <div className="flex flex-col h-full">
        <ChatHeader
          mode={mode}
          onModeChange={setMode}
          provider="None"
          onOpenSettings={() => setShowSettings(true)}
        />
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Key className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No API Key Configured</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add a Grok, OpenAI, or Gemini API key to start using the AI assistant.
            </p>
            <Button onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure API Keys
            </Button>
          </div>
        </div>

        <AISettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatHeader
        mode={mode}
        onModeChange={setMode}
        provider={agent.currentProvider}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {agent.messages.length === 0 ? (
          <EmptyState />
        ) : (
          agent.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {/* Loading indicator */}
        {agent.isLoading && !agent.pendingConfirmation && (
          <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Thinking...
          </div>
        )}

        {/* Error display */}
        {agent.error && (
          <div className="mx-4 my-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
            {agent.error.message}
          </div>
        )}
      </ScrollArea>

      {/* Confirmation panel (when waiting for approval) */}
      {agent.pendingConfirmation && (
        <ConfirmationPanel
          confirmation={agent.pendingConfirmation}
          onConfirm={agent.confirmSql}
          onReject={agent.rejectSql}
        />
      )}

      {/* Auto-accept toggle */}
      <div className="border-t px-4 py-2 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Switch
            id="auto-accept"
            checked={autoAcceptSql}
            onCheckedChange={setAutoAcceptSql}
          />
          <label htmlFor="auto-accept" className="cursor-pointer">
            Auto-accept SQL execution
          </label>
        </div>
        {autoAcceptSql && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            No confirmation
          </Badge>
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={agent.input}
        onChange={agent.setInput}
        onSubmit={handleSubmit}
        onStop={agent.stop}
        isLoading={agent.isLoading}
        disabled={!!agent.pendingConfirmation}
      />

      {/* Settings dialog */}
      <AISettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

// Header sub-component
interface ChatHeaderProps {
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  provider: string;
  onOpenSettings: () => void;
}

function ChatHeader({ mode, onModeChange, provider, onOpenSettings }: ChatHeaderProps) {
  return (
    <div className="border-b p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-semibold">Velocity AI</h2>
          <p className="text-xs text-muted-foreground">
            Using {provider}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <ModeSelector mode={mode} onChange={onModeChange} />
        <Button variant="ghost" size="icon" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Empty state sub-component
function EmptyState() {
  return (
    <div className="p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
        <Bot className="h-6 w-6 text-purple-500" />
      </div>
      <h3 className="font-medium mb-2">How can I help?</h3>
      <p className="text-sm text-muted-foreground mb-4">
        I can analyze your database schema, write SQL queries, and help optimize performance.
      </p>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Try asking:</p>
        <p className="font-mono bg-muted rounded px-2 py-1 inline-block">"What tables are in this database?"</p>
        <p className="font-mono bg-muted rounded px-2 py-1 inline-block">"Show me the schema for users table"</p>
        <p className="font-mono bg-muted rounded px-2 py-1 inline-block">"Write a query to find inactive users"</p>
      </div>
    </div>
  );
}
