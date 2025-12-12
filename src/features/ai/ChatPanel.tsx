// ChatPanel Component
// Main AI chat interface container

import { useState, useRef, useEffect } from 'react';
import { Key, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useVelocityAgent } from './useVelocityAgent';
import { useAISettingsStore } from './ai-settings.store';
import { useAppStore } from '@/stores/app.store';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { useMentions } from './useMentions';
import type { AgentMode } from './types';

interface ChatPanelProps {
  connectionId: string;
}

export function ChatPanel({ connectionId }: ChatPanelProps) {
  const [mode, setMode] = useState<AgentMode>('fast');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { autoAcceptSql, setAutoAcceptSql, preferredProvider, setPreferredProvider } = useAISettingsStore();
  const { setAiPanelOpen } = useAppStore();

  const agent = useVelocityAgent({ connectionId, mode });
  const mentions = useMentions({ connectionId });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.messages]);

  // Auto-refresh tables on successful schema mutation
  useEffect(() => {
    const lastMsg = agent.messages[agent.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    
    const hasSuccessfulMutation = lastMsg.parts?.some(p => 
      p.type === 'tool-invocation' && 
      p.status === 'success' && 
      (p.toolName === 'execute_ddl' || 
       p.toolName === 'create_table' || 
       (p.toolName === 'run_sql_query' && p.args?.sql && typeof p.args.sql === 'string' && 
        (p.args.sql.toUpperCase().includes('CREATE') || 
         p.args.sql.toUpperCase().includes('DROP') || 
         p.args.sql.toUpperCase().includes('ALTER'))))
    );

    if (hasSuccessfulMutation) {
      console.log('[ChatPanel] Mutation detected, refreshing tables...');
      mentions.refreshTables();
    }
  }, [agent.messages, mentions.refreshTables]);

  const handleSubmit = async () => {
    if (!agent.input.trim()) return;
    const input = agent.input;
    const currentMentions = [...mentions.mentions]; // Capture current mentions
    const hasWeb = mentions.hasWebMention;

    // Clear input and mentions immediately for better UI responsiveness
    agent.setInput('');
    mentions.clearMentions();

    // Pass captured mentions to append for context injection
    await agent.append({ 
      role: 'user', 
      content: input,
    }, currentMentions, hasWeb);
  };

  // No provider configured
  if (!agent.hasProvider) {
    return (
      <div className="flex flex-col h-full">
        <ChatHeader
          onClose={() => setAiPanelOpen(false)}
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <ChatHeader
        onClose={() => setAiPanelOpen(false)}
      />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 px-4" ref={scrollRef}>
        {agent.messages.length === 0 ? (
          <EmptyState onSuggestionClick={agent.setInput} />
        ) : (
          agent.messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              onConfirm={() => agent.confirmSql()}
              onReject={(reason) => agent.rejectSql(reason)}
            />
          ))
        )}

        {/* Error display */}
        {agent.error && (
          <div className="mx-4 my-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
            {agent.error.message}
          </div>
        )}
      </ScrollArea>

      {/* Confirmation panel removed - now inline */}

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
        mentions={mentions.mentions}
        onAddMention={mentions.addMention}
        onRemoveMention={mentions.removeMention}
        availableTables={mentions.availableTables}
      />
    </div>
  );
}

// Header sub-component
interface ChatHeaderProps {
  onClose: () => void;
}

function ChatHeader({ onClose }: ChatHeaderProps) {
  return (
    <div className="absolute top-2 right-2 z-10">
      <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full opacity-70 hover:opacity-100 hover:bg-muted">
        <X className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

// Empty state sub-component
function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <div className="p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <img src="/svg/velocity-ia.svg" className="h-16 w-16" alt="Velocity AI" />
      </div>
      <h3 className="font-medium mb-2">How can I help?</h3>
      <p className="text-sm text-muted-foreground mb-4">
        I can analyze your database schema, write SQL queries, and help optimize performance.
      </p>
      <div className="text-xs text-muted-foreground space-y-2 flex flex-col items-center">
        <p>Try asking:</p>
        <button 
          onClick={() => onSuggestionClick("What tables are in this database?")}
          className="font-mono bg-muted rounded px-2 py-1 inline-block hover:bg-muted/80 cursor-pointer transition-colors"
        >
          What tables are in this database?
        </button>
        <button 
          onClick={() => onSuggestionClick("Show me the schema for users table")}
          className="font-mono bg-muted rounded px-2 py-1 inline-block hover:bg-muted/80 cursor-pointer transition-colors"
        >
          Show me the schema for users table
        </button>
        <button 
          onClick={() => onSuggestionClick("Write a query to find inactive users")}
          className="font-mono bg-muted rounded px-2 py-1 inline-block hover:bg-muted/80 cursor-pointer transition-colors"
        >
          Write a query to find inactive users
        </button>
      </div>
    </div>
  );
}
