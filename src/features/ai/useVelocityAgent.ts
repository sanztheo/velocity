// Velocity AI Agent Hook
// Core hook for chat functionality using @midday-ai/ai-sdk-tools

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAISettingsStore, hasAnyProviderAvailable, getBestProvider } from './ai-settings.store';
import { getModeConfig, AgentModeKey } from './ai-modes';
import { createTools } from './tools';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, CoreMessage } from 'ai';
import { Mention } from './useMentions';
import { invoke } from '@tauri-apps/api/core';
import { PendingSqlConfirmation } from './types';

// We reuse ChatMessage interface from UI but need to adapt to AI SDK
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data';
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
  status?: 'pending' | 'executing' | 'success' | 'error' | 'awaiting-confirmation';
}

// Helper to check for destructive SQL
const isDestructive = (toolName: string, args: Record<string, unknown>): boolean => {
  if (toolName === 'execute_ddl') return true;
  if (toolName === 'run_sql_query' && typeof args.sql === 'string') {
    const sql = args.sql.trim().toUpperCase();
    return sql.startsWith('INSERT') ||
           sql.startsWith('UPDATE') ||
           sql.startsWith('DELETE') ||
           sql.startsWith('DROP') ||
           sql.startsWith('ALTER') ||
           sql.startsWith('TRUNCATE') ||
           sql.startsWith('CREATE');
  }
  return false;
};

interface UseVelocityAgentOptions {
  connectionId: string;
  mode: AgentModeKey;
}

interface UseVelocityAgentReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: Error | undefined;
  append: (message: { role: 'user'; content: string }, mentions?: Mention[], enableWebSearch?: boolean) => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  pendingConfirmation: Omit<PendingSqlConfirmation, 'resolve' | 'reject'> | null;
  confirmSql: () => Promise<void>;
  rejectSql: (reason: string) => Promise<void>;
  hasProvider: boolean;
  currentProvider: string;
}

export function useVelocityAgent({ connectionId, mode }: UseVelocityAgentOptions): UseVelocityAgentReturn {
  const settings = useAISettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingSqlConfirmation | null>(null);
  
  // Abort controller for cancelling requests
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

  // Create the provider instance
  const getProviderInstance = async () => {
    const providerName = (settings.preferredProvider || getBestProvider(settings) || 'grok') as 'grok' | 'openai' | 'gemini';
    const apiKey = await settings.getApiKey(providerName);

    if (!apiKey) {
      throw new Error(`No API key found for ${providerName}`);
    }

    if (providerName === 'grok') {
        return createXai({ apiKey });
    } else if (providerName === 'openai') {
        return createOpenAI({ apiKey });
    } else if (providerName === 'gemini') {
        return createGoogleGenerativeAI({ apiKey });
    }

    throw new Error('Unknown provider');
  };

  const checkConfirmation = useCallback(async (toolName: string, args: Record<string, unknown>) => {
      // Check if destructive and auto-accept is off
      if (isDestructive(toolName, args) && !settings.autoAcceptSql) {
          return new Promise<void>((resolve, reject) => {
              setPendingConfirmation({
                  toolCallId: 'pending', // We don't have ID here easily, but we can match by state
                  sql: (args.sql as string) || 'Destructive Operation',
                  isMutation: true,
                  // We cast resolve/reject to any because they are stored in state but used to resolve promise
                  resolve: () => {
                      setPendingConfirmation(null);
                      resolve();
                  },
                  reject: (reason: string) => {
                      setPendingConfirmation(null);
                      reject(reason);
                  }
              } as PendingSqlConfirmation);
          });
      }
  }, [settings.autoAcceptSql]);

  const append = useCallback(async (
    message: { role: 'user'; content: string },
    mentions: Mention[] = [],
    _enableWebSearch: boolean = false
  ) => {
    setError(undefined);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    // 1. Add user message to UI immediately
    const userMsgId = Date.now().toString();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: message.content,
      parts: [{ type: 'text', text: message.content }],
      createdAt: new Date(),
    };
    
    setMessages(prev => [...prev, newUserMsg]);

    try {
      // 2. Prepare context
      let contextPrefix = '';
      const tableMentions = mentions.filter(m => m.type === 'table');
      if (tableMentions.length > 0) {
        const schemaPromises = tableMentions.map(async (m) => {
          try {
            const schema = await invoke('get_table_schema', { connectionId, tableName: m.value });
            return `## Table: ${m.value}\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
          } catch {
            return `## Table: ${m.value}\n(Failed to load schema)`;
          }
        });
        const schemas = await Promise.all(schemaPromises);
        contextPrefix = `<context>\nThe user mentioned these tables. Here is their schema:\n${schemas.join('\n\n')}\n</context>\n\n`;
      }

      // 3. Prepare full conversation history for AI SDK
      const history: CoreMessage[] = messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const provider = await getProviderInstance();
      const modeConfig = getModeConfig(mode);
      const providerName = (settings.preferredProvider || getBestProvider(settings) || 'grok') as 'grok' | 'openai' | 'gemini';
      const modelId = modeConfig.models[providerName];

      // 4. Create Assistant Message Placeholder
      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        parts: [],
        createdAt: new Date(),
      }]);

      // 5. Stream Text with Tools
      const result = streamText({
        model: provider(modelId),
        system: modeConfig.systemPrompt,
        messages: [
          ...history,
          { role: 'user', content: contextPrefix + message.content }
        ],
        tools: createTools(connectionId, checkConfirmation),
        maxSteps: modeConfig.maxSteps, // Allow multi-step tool calls
        abortSignal: abortControllerRef.current.signal,
        onChunk: (event: any) => {
            // Update the assistant message in real-time
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx < 0 || updated[lastIdx].id !== assistantMsgId) return prev;

                const lastMsg = { ...updated[lastIdx] };
                let parts = [...(lastMsg.parts || [])];

                if (event.chunk.type === 'text-delta') {
                    const text = event.chunk.textDelta;
                    if (text) {
                        const textPartIdx = parts.findIndex(p => p.type === 'text');
                        if (textPartIdx >= 0) {
                            parts[textPartIdx] = {
                                ...parts[textPartIdx],
                                text: (parts[textPartIdx].text || '') + text
                            };
                        } else {
                            parts.push({ type: 'text', text: text });
                        }
                        lastMsg.content = (lastMsg.content || '') + text;
                    }
                } else if (event.chunk.type === 'tool-call') {
                    const chunk = event.chunk as any;
                    parts.push({
                        type: 'tool-invocation',
                        toolName: chunk.toolName,
                        toolCallId: chunk.toolCallId,
                        args: chunk.args,
                        status: 'executing'
                    });
                } else if (event.chunk.type === 'tool-result') {
                     const chunk = event.chunk as any;
                     const partIdx = parts.findIndex(p => p.type === 'tool-invocation' && p.toolCallId === chunk.toolCallId);
                     if (partIdx >= 0) {
                         parts[partIdx] = {
                             ...parts[partIdx],
                             status: 'success',
                             result: chunk.result
                         };
                     }
                } else if (event.chunk.type === 'reasoning') {
                    const chunk = event.chunk as any;
                    const text = chunk.textDelta;
                    if (text) {
                        const reasoningPartIdx = parts.findIndex(p => p.type === 'reasoning');
                        if (reasoningPartIdx >= 0) {
                             parts[reasoningPartIdx] = {
                                 ...parts[reasoningPartIdx],
                                 text: (parts[reasoningPartIdx].text || '') + text
                             };
                        } else {
                            parts.unshift({ type: 'reasoning', text: text });
                        }
                    }
                }

                lastMsg.parts = parts;
                updated[lastIdx] = lastMsg;
                return updated;
            });
        },
      } as any);

      await result.text;

    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('AI Error:', e);
        setError(e);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, connectionId, mode, settings, checkConfirmation]);

  const reload = useCallback(async () => {
      // Not implemented in this simplified version
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const confirmSql = useCallback(async () => {
     if (pendingConfirmation && 'resolve' in pendingConfirmation) {
         (pendingConfirmation as any).resolve();
     }
  }, [pendingConfirmation]);

  const rejectSql = useCallback(async (reason: string) => {
     if (pendingConfirmation && 'reject' in pendingConfirmation) {
         (pendingConfirmation as any).reject(reason);
     }
  }, [pendingConfirmation]);

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
