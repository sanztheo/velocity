// Velocity AI Agent Hook
// Core hook for chat functionality using Tauri backend streaming

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { useAISettingsStore, hasAnyProviderAvailable, getBestProvider } from './ai-settings.store';
import { getModeConfig } from './ai-modes';
import type { AgentMode, PendingSqlConfirmation } from './types';
import type { Mention } from './useMentions';

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
  append: (message: { role: 'user'; content: string }, mentions?: Mention[], enableWebSearch?: boolean) => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  pendingConfirmation: PendingSqlConfirmation | null;
  confirmSql: () => Promise<void>;
  rejectSql: (reason: string) => Promise<void>;
  hasProvider: boolean;
  currentProvider: string;
}

// System prompts moved to ai-modes.ts for better separation of concerns

export function useVelocityAgent({ connectionId, mode }: UseVelocityAgentOptions): UseVelocityAgentReturn {
  const settings = useAISettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingSqlConfirmation | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingToolCallsRef = useRef<{ id: string; name: string; args: Record<string, unknown> }[]>([]);

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

  // Execute a tool call
  const executeTool = useCallback(async (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
    console.log('[Execute Tool]', toolName, args);
    
    try {
      switch (toolName) {
        case 'get_database_schema':
          return await invoke('get_database_schema_full', { id: connectionId });
        
        case 'run_sql_query':
          return await invoke('execute_query', { id: connectionId, sql: args.sql as string });
        
        case 'list_tables':
          return await invoke('list_tables', { id: connectionId });
        
        case 'get_table_schema':
          return await invoke('get_table_schema', { id: connectionId, tableName: args.table_name as string });
        
        case 'execute_ddl':
          return await invoke('execute_ddl', { id: connectionId, sql: args.sql as string });
        
        case 'explain_query':
          return await invoke('explain_query', { id: connectionId, sql: args.sql as string });
        
        case 'get_table_preview':
          return await invoke('get_table_data', { 
            id: connectionId, 
            tableName: args.table_name as string,
            limit: (args.limit as number) || 10,
            offset: 0 
          });
        
        case 'get_table_indexes':
          return await invoke('get_table_indexes', { id: connectionId, tableName: args.table_name as string });
        
        case 'get_table_foreign_keys':
          return await invoke('get_table_foreign_keys', { id: connectionId, tableName: args.table_name as string });
        
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (e) {
      console.error(`[Tool Error] ${toolName}:`, e);
      return { error: String(e) };
    }
  }, [connectionId]);

  // Send message and stream response with agentic loop
  const append = useCallback(async (
    message: { role: 'user'; content: string },
    mentions: Mention[] = [],
    enableWebSearch: boolean = false
  ) => {
    setError(undefined);
    setIsLoading(true);
    pendingToolCallsRef.current = [];

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
      // Get mode-specific configuration
      const modeConfig = getModeConfig(mode);
      
      // Determine provider
      const provider = (settings.preferredProvider || getBestProvider(settings) || 'grok') as 'grok' | 'openai' | 'gemini';
      
      // Get model based on mode and provider from config
      const model = modeConfig.models[provider];
      const maxSteps = modeConfig.maxSteps || 5;

      // Build context from mentioned tables
      let contextPrefix = '';
      const tableMentions = mentions.filter(m => m.type === 'table');
      if (tableMentions.length > 0) {
        const schemaPromises = tableMentions.map(async (m) => {
          try {
            const schema = await invoke('get_table_schema', { id: connectionId, tableName: m.value });
            return `## Table: ${m.value}\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
          } catch {
            return `## Table: ${m.value}\n(Failed to load schema)`;
          }
        });
        const schemas = await Promise.all(schemaPromises);
        contextPrefix = `<context>\nThe user mentioned these tables. Here is their schema:\n${schemas.join('\n\n')}\n</context>\n\n`;
      }

      // Build initial messages for API
      // Type for API messages that can include tool calls
      type ApiMessage = {
        role: string;
        content: string;
        toolCalls?: { id: string; callType: string; function: { name: string; arguments: string } }[];
        toolCallId?: string;
      };
      
      const apiMessages: ApiMessage[] = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
      // Add user message with context prefix
      apiMessages.push({ role: 'user', content: contextPrefix + message.content });

      // ===== AGENTIC LOOP =====
      // Continue until no tool calls or maxSteps reached
      let step = 0;
      let continueLoop = true;

      while (continueLoop && step < maxSteps) {
        step++;
        console.log(`[Agent Step ${step}/${maxSteps}]`);
        
        // Reset pending tool calls for this step
        pendingToolCallsRef.current = [];

        // Create channel for streaming
        const channel = new Channel<AiChatChunk>();

        channel.onmessage = (chunk: AiChatChunk) => {
          console.log(`[Step ${step}] Chunk:`, chunk);

          if (chunk.type === 'toolCall') {
            // Accumulate tool calls for later execution
            pendingToolCallsRef.current.push({
              id: chunk.id || `tool-${Date.now()}`,
              name: chunk.name || 'unknown',
              args: chunk.arguments ? JSON.parse(chunk.arguments) : {},
            });
          }

          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx < 0) return prev;
            
            const lastMsg = { ...updated[lastIdx] };
            const parts = [...(lastMsg.parts || [])];

            switch (chunk.type) {
              case 'textDelta': {
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
            systemPrompt: modeConfig.systemPrompt,
            maxTokens: modeConfig.maxTokens,
            temperature: modeConfig.temperature,
            enableWebSearch: step === 1 ? enableWebSearch : false, // Only enable web search on first step
          },
          onEvent: channel,
        });

        // Check if we have tool calls to execute
        if (pendingToolCallsRef.current.length === 0) {
          // No tool calls, we're done!
          console.log(`[Step ${step}] No tool calls, ending loop`);
          continueLoop = false;
        } else {
          // Execute tool calls and prepare for next iteration
          console.log(`[Step ${step}] Executing ${pendingToolCallsRef.current.length} tool calls`);
          const toolCallsCopy = [...pendingToolCallsRef.current];
          const toolResults: { tool_call_id: string; role: 'tool'; content: string }[] = [];

          for (const toolCall of toolCallsCopy) {
            // Update status to executing
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx < 0) return prev;
              
              const lastMsg = { ...updated[lastIdx] };
              const parts = [...(lastMsg.parts || [])];
              const toolPartIdx = parts.findIndex(p => p.type === 'tool-invocation' && p.toolCallId === toolCall.id);
              if (toolPartIdx >= 0) {
                parts[toolPartIdx] = { ...parts[toolPartIdx], status: 'executing' };
              }
              lastMsg.parts = parts;
              updated[lastIdx] = lastMsg;
              return updated;
            });

            // Execute the tool
            const result = await executeTool(toolCall.name, toolCall.args);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(result),
            });
            
            // Update with result
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx < 0) return prev;
              
              const lastMsg = { ...updated[lastIdx] };
              const parts = [...(lastMsg.parts || [])];
              const toolPartIdx = parts.findIndex(p => p.type === 'tool-invocation' && p.toolCallId === toolCall.id);
              if (toolPartIdx >= 0) {
                parts[toolPartIdx] = { 
                  ...parts[toolPartIdx], 
                  status: 'success',
                  result,
                };
              }
              lastMsg.parts = parts;
              updated[lastIdx] = lastMsg;
              return updated;
            });
          }

          // Add assistant message with tool calls to history
          apiMessages.push({
            role: 'assistant',
            content: '',
            toolCalls: toolCallsCopy.map(tc => ({
              id: tc.id,
              callType: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.args) }
            }))
          });

          // Add tool results to history
          for (const tr of toolResults) {
            apiMessages.push({
              role: 'tool',
              content: tr.content,
              toolCallId: tr.tool_call_id
            });
          }

          console.log(`[Step ${step}] Added results to history, continuing loop...`);
        }
      }

      if (step >= maxSteps) {
        console.log(`[Agent] Reached maxSteps (${maxSteps}), stopping`);
      }
      
      setIsLoading(false);

    } catch (e) {
      console.error('[AI Error]', e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
    }
  }, [messages, settings, mode, executeTool, connectionId]);

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
