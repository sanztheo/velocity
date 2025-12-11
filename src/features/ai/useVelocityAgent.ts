// Velocity AI Agent Hook
// Core hook for chat functionality using Tauri backend streaming

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { useAISettingsStore, hasAnyProviderAvailable, getBestProvider } from './ai-settings.store';
import type { AgentMode, PendingSqlConfirmation } from './types';

// Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: MessagePart[];
  createdAt: Date;
}

export interface MessagePart {
  type: 'text' | 'reasoning' | 'tool-invocation';
  text?: string;
  content?: string;
  toolName?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status?: 'pending' | 'executing' | 'success' | 'error';
}

// Chunk types from Rust backend
interface AiChatChunk {
  type: 'textDelta' | 'toolCall' | 'reasoning' | 'done' | 'error';
  text?: string;
  id?: string;
  name?: string;
  arguments?: string;
  finishReason?: string;
  message?: string;
}

interface UseVelocityAgentOptions {
  connectionId: string;
  mode: AgentMode;
}

interface UseVelocityAgentReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | undefined;
  append: (message: { role: 'user'; content: string }) => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  pendingConfirmation: PendingSqlConfirmation | null;
  confirmSql: () => Promise<void>;
  rejectSql: (reason: string) => Promise<void>;
  hasProvider: boolean;
  currentProvider: string;
}

const SYSTEM_PROMPT = `You are Velocity AI, an expert SQL developer and database administrator assistant integrated into the Velocity database client.

<identity>
You are a methodical, intelligent agent that THINKS before acting. You break down complex tasks into manageable steps and verify your work.
</identity>

<communication>
1. Be concise and do not repeat yourself.
2. Be conversational but professional.
3. Refer to the USER in the second person and yourself in the first person.
4. Format your responses in markdown. Use backticks to format table, column, and SQL keywords.
5. NEVER lie or make things up.
</communication>

<agentic_workflow>
For complex multi-step tasks (creating tables, migrations, bulk operations), you MUST follow this workflow:

## 1. PLAN (Think First)
Before taking ANY action:
- **Analyze the request**: What exactly does the user want?
- **Check dependencies**: What tables/schemas need to exist first?
- **Outline steps**: List the exact sequence of operations.

## 2. EXECUTE (One Step at a Time)
- Execute ONE operation per tool call
- For DDL: Execute in dependency order (parents before children)
- WAIT for each result before proceeding

## 3. VERIFY (Check Your Work)
After completing operations, confirm what was created.
</agentic_workflow>

<tool_calling>
1. **Always analyze the schema first** before writing queries.
2. **Explain before acting**: Briefly explain why you are calling a tool.
3. **Safety First**: For data modification, explain the impact clearly.
4. **No Hallucinations**: Do not assume table names. Check the schema.
5. **One operation at a time**: Never try to batch multiple DDL statements.
</tool_calling>

<formatting>
- Format SQL queries in code blocks with the language set to \`sql\`.
- When showing results, summarize large datasets.
- When presenting a plan, use numbered lists for clarity.
</formatting>`;

export function useVelocityAgent({ connectionId: _connectionId, mode }: UseVelocityAgentOptions): UseVelocityAgentReturn {
  const settings = useAISettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingSqlConfirmation | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load env keys on mount
  useEffect(() => {
    settings.loadEnvKeys();
  }, []);

  const hasProvider = useMemo(() => hasAnyProviderAvailable(settings), [settings]);

  const currentProvider = useMemo(() => {
    if (settings.preferredProvider) {
      if (settings.preferredProvider === 'grok' && (settings.grokApiKey || settings.envKeysStatus?.grokAvailable)) return 'Grok';
      if (settings.preferredProvider === 'openai' && (settings.openaiApiKey || settings.envKeysStatus?.openaiAvailable)) return 'OpenAI';
      if (settings.preferredProvider === 'gemini' && (settings.geminiApiKey || settings.envKeysStatus?.geminiAvailable)) return 'Gemini';
    }
    const best = getBestProvider(settings);
    if (best === 'grok') return 'Grok';
    if (best === 'openai') return 'OpenAI';
    if (best === 'gemini') return 'Gemini';
    return 'None';
  }, [settings]);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Send message and stream response
  const append = useCallback(async (message: { role: 'user'; content: string }) => {
    setError(undefined);
    setIsLoading(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message.content,
      parts: [{ type: 'text', text: message.content }],
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Create assistant message placeholder
    const assistantId = generateId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      parts: [],
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      // Determine provider
      const provider = settings.preferredProvider || getBestProvider(settings) || 'grok';
      
      // Get model based on mode
      let model: string | undefined;
      if (mode === 'deep') {
        if (provider === 'grok') model = 'grok-3-mini-fast';
        else if (provider === 'openai') model = 'gpt-4o';
        else if (provider === 'gemini') model = 'gemini-2.0-flash';
      } else {
        if (provider === 'grok') model = 'grok-3-mini-fast';
        else if (provider === 'openai') model = 'gpt-4o-mini';
        else if (provider === 'gemini') model = 'gemini-2.0-flash';
      }

      // Build messages for API
      const apiMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
      apiMessages.push({ role: 'user', content: message.content });

      // Create channel for streaming
      const channel = new Channel<AiChatChunk>();

      channel.onmessage = (chunk: AiChatChunk) => {
        console.log('[AI Chunk]', chunk);

        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx < 0) return prev;
          
          const lastMsg = { ...updated[lastIdx] };
          const parts = [...(lastMsg.parts || [])];

          switch (chunk.type) {
            case 'textDelta': {
              // Find existing text part and append to it
              const textPartIdx = parts.findIndex(p => p.type === 'text');
              if (textPartIdx >= 0) {
                const existingText = parts[textPartIdx].text || '';
                const newText = existingText + (chunk.text || '');
                parts[textPartIdx] = { ...parts[textPartIdx], text: newText };
                lastMsg.content = newText;
              } else {
                const newText = chunk.text || '';
                parts.push({ type: 'text', text: newText });
                lastMsg.content = newText;
              }
              break;
            }

            case 'reasoning': {
              // Find existing reasoning part and append to it
              const reasoningIdx = parts.findIndex(p => p.type === 'reasoning');
              if (reasoningIdx >= 0) {
                const existingReasoning = parts[reasoningIdx].text || parts[reasoningIdx].content || '';
                const newReasoning = existingReasoning + (chunk.text || '');
                parts[reasoningIdx] = { ...parts[reasoningIdx], text: newReasoning, content: newReasoning };
              } else {
                const newReasoning = chunk.text || '';
                parts.unshift({ type: 'reasoning', text: newReasoning, content: newReasoning });
              }
              break;
            }

            case 'toolCall':
              parts.push({
                type: 'tool-invocation',
                toolName: chunk.name,
                toolCallId: chunk.id,
                args: chunk.arguments ? JSON.parse(chunk.arguments) : {},
                status: 'pending',
              });
              break;

            case 'done':
              setIsLoading(false);
              break;

            case 'error':
              setError(new Error(chunk.message || 'Unknown error'));
              setIsLoading(false);
              break;
          }

          lastMsg.parts = parts;
          updated[lastIdx] = lastMsg;
          return updated;
        });
      };

      // Invoke Tauri command
      await invoke('ai_chat_stream', {
        request: {
          messages: apiMessages,
          model,
          provider,
          systemPrompt: SYSTEM_PROMPT,
          maxTokens: 4096,
          temperature: 0.7,
        },
        onEvent: channel,
      });

    } catch (e) {
      console.error('[AI Error]', e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }
  }, [messages, settings, mode]);

  // Reload last message
  const reload = useCallback(async () => {
    if (messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setMessages(prev => prev.slice(0, -1));
      await append({ role: 'user', content: lastUserMsg.content });
    }
  }, [messages, append]);

  // Stop streaming
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  // Confirm SQL execution
  const confirmSql = useCallback(async () => {
    if (!pendingConfirmation) return;
    setPendingConfirmation(null);
  }, [pendingConfirmation]);

  // Reject SQL
  const rejectSql = useCallback(async (_reason: string) => {
    setPendingConfirmation(null);
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    append,
    reload,
    stop,
    pendingConfirmation,
    confirmSql,
    rejectSql,
    hasProvider,
    currentProvider,
  };
}
