// ChatPanel Component
// Main AI chat interface container

import { useState, useRef, useEffect } from 'react';
import { Bot, Key, Settings } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useVelocityAgent } from './useVelocityAgent';
import { useAISettingsStore } from './ai-settings.store';
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
  const { autoAcceptSql, setAutoAcceptSql, preferredProvider, setPreferredProvider } = useAISettingsStore();

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
              Configure API Keys
            </Button>
          </div>
        </div>

        <AISettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <ChatHeader
        provider={agent.currentProvider}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 px-4" ref={scrollRef}>
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



      {/* Input */}
      <ChatInput
        value={agent.input}
        onChange={agent.setInput}
        onSubmit={handleSubmit}
        onStop={agent.stop}
        isLoading={agent.isLoading}
        disabled={!!agent.pendingConfirmation}
        mode={mode}
        onModeChange={setMode}
        provider={preferredProvider}
        onProviderChange={setPreferredProvider}
        autoAccept={autoAcceptSql}
        onAutoAcceptChange={setAutoAcceptSql}
      />

      {/* Settings dialog */}
      <AISettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

// Header sub-component
interface ChatHeaderProps {
  provider: string;
  onOpenSettings: () => void;
}

function ChatHeader({ provider, onOpenSettings }: ChatHeaderProps) {
  return (
    <div className="border-b px-4 py-3 flex items-center justify-between gap-4 bg-background/50 backdrop-blur-sm z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-sm">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">Velocity AI</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {provider}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-8 w-8">
        <Settings className="h-4 w-4 text-muted-foreground" />
      </Button>
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
