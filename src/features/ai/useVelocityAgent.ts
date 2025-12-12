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
  role: 'user' | 'assistant' | 'system' | 'tool';
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

// API Message type
type ApiMessage = {
  role: string;
  content: string;
  toolCalls?: { id: string; callType: string; function: { name: string; arguments: string } }[];
  toolCallId?: string;
};

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
           sql.startsWith('TRUNCATE');
  }
  return false;
};

export function useVelocityAgent({ connectionId, mode }: UseVelocityAgentOptions): UseVelocityAgentReturn {
  const settings = useAISettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingSqlConfirmation | null>(null);
  
  // State to resume the loop
  const loopStateRef = useRef<{
    apiMessages: ApiMessage[];
    step: number;
    maxSteps: number;
    pendingToolCalls: { id: string; name: string; args: Record<string, unknown> }[];
    approvedToolIds: string[]; // Track IDs that were approved in this step
  } | null>(null);

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

  // Main Agent Loop
  const runAgentLoop = useCallback(async (
    initialApiMessages: ApiMessage[],
    startStep: number,
    maxSteps: number,
    initialPendingToolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [],
    enableWebSearch: boolean = false,
    initialApprovedToolIds: string[] = [] // Whitelist of already approved tool IDs
  ) => {
    let step = startStep;
    let apiMessages = [...initialApiMessages];
    let currentPendingToolCalls = [...initialPendingToolCalls];
    let approvedToolIds = [...initialApprovedToolIds]; // Track locally for this run
    let continueLoop = true;

    try {
      while (continueLoop && step < maxSteps) {
        // If we have pending tool calls (from previous iteration or paused state), execute them first
        if (currentPendingToolCalls.length > 0) {
          console.log(`[Step ${step}] Processing ${currentPendingToolCalls.length} tool calls`);
          
          // 1. Separate tools into executable (safe or approved) and blocked
          const executableTools: typeof currentPendingToolCalls = [];
          const blockedTools: typeof currentPendingToolCalls = [];

          for (const tc of currentPendingToolCalls) {
            const isBlocked = !settings.autoAcceptSql && 
                              isDestructive(tc.name, tc.args) && 
                              !approvedToolIds.includes(tc.id);
            
            if (isBlocked) {
              blockedTools.push(tc);
            } else {
              executableTools.push(tc);
            }
          }

          // 2. If we have executable tools, run them IMMEDIATELY
          if (executableTools.length > 0) {
            const toolResults: { tool_call_id: string; role: 'tool'; content: string }[] = [];
            
            for (const toolCall of executableTools) {
              // Update UI status to executing
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

              // Execute
              const result = await executeTool(toolCall.name, toolCall.args);
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: JSON.stringify(result),
              });

              // Update UI with result
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

            // Add results to history
            for (const tr of toolResults) {
              apiMessages.push({
                role: 'tool',
                content: tr.content,
                toolCallId: tr.tool_call_id
              });
            }

            // Update currentPendingToolCalls to only contain blocked tools for next pass
            currentPendingToolCalls = blockedTools;
            
            // If we executed something, loop back immediately to check if we have blocked tools left
            // effectively "refreshing" the state for the next check
            continue;
          }

          // 3. If we are here, we ONLY have blocked tools (or empty list if everything was executed)
          if (blockedTools.length > 0) {
             const destructiveCall = blockedTools[0]; // Take the first one
             console.log('[Agent] Pausing for confirmation:', destructiveCall);
            
             // Update UI status to awaiting-confirmation
             setMessages(prev => {
               const updated = [...prev];
               const lastIdx = updated.length - 1;
               if (lastIdx < 0) return prev;
               
               const lastMsg = { ...updated[lastIdx] };
               const parts = [...(lastMsg.parts || [])];
               const toolPartIdx = parts.findIndex(p => p.type === 'tool-invocation' && p.toolCallId === destructiveCall.id);
               if (toolPartIdx >= 0) {
                 parts[toolPartIdx] = { ...parts[toolPartIdx], status: 'awaiting-confirmation' };
               }
               lastMsg.parts = parts;
               updated[lastIdx] = lastMsg;
               return updated;
             });

             // Save state to resume later
             // IMPORTANT: We save `blockedTools` as the pending ones, so when we resume, we only process them
             loopStateRef.current = {
               apiMessages,
               step,
               maxSteps,
               pendingToolCalls: blockedTools,
               approvedToolIds
             };
             
             setPendingConfirmation({
               toolCallId: destructiveCall.id,
               sql: destructiveCall.args.sql as string || 'Destructive Operation',
               isMutation: true,
             });
             
             setIsLoading(false); 
             return; // EXIT LOOP
          }
          
          // 4. If list is empty (everything was executed in step 2 and stripped), we act as "done with tools"
          
          // Increment step only after full cycle of tools is cleared
          step++;
          approvedToolIds = []; // Clear whitelist for new step
        }
        
        // Generate next response logic...
        console.log(`[Agent Step ${step}] Generating next response...`);
        
        // Create new assistant message placeholder
        const assistantId = generateId();
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          parts: [],
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Get config
        const modeConfig = getModeConfig(mode);
        const provider = (settings.preferredProvider || getBestProvider(settings) || 'grok') as 'grok' | 'openai' | 'gemini';
        const model = modeConfig.models[provider];

        // Create channel
        const channel = new Channel<AiChatChunk>();
        const newToolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];

        channel.onmessage = (chunk: AiChatChunk) => {
             if (chunk.type === 'toolCall') {
            newToolCalls.push({
              id: chunk.id || `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

        // Invoke Tauri
        await invoke('ai_chat_stream', {
          request: {
            messages: apiMessages,
            model,
            provider,
            systemPrompt: modeConfig.systemPrompt,
            maxTokens: modeConfig.maxTokens,
            temperature: modeConfig.temperature,
            enableWebSearch: step === 0 && enableWebSearch, 
          },
          onEvent: channel,
        });

        // Decide next step
        if (newToolCalls.length === 0) {
          console.log(`[Step ${step}] No new tool calls. Detailed finished.`);
          continueLoop = false;
        } else {
          console.log(`[Step ${step}] Received ${newToolCalls.length} new tool calls.`);
          currentPendingToolCalls = newToolCalls;
          
           // Add assistant message with tool calls to history explicitly
          apiMessages.push({
            role: 'assistant',
            content: '', // Content is often empty for tool calls in newer models
            toolCalls: newToolCalls.map(tc => ({
              id: tc.id,
              callType: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.args) }
            }))
          });
        }
      } 
      
      setIsLoading(false);
      loopStateRef.current = null; // Clear state on success

    } catch (e) {
      console.error('[Agent Loop Error]', e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsLoading(false);
      loopStateRef.current = null;
    }
  }, [mode, settings, executeTool]);


  // Initialize conversation
  const append = useCallback(async (
    message: { role: 'user'; content: string },
    mentions: Mention[] = [],
    enableWebSearch: boolean = false
  ) => {
    setError(undefined);
    setIsLoading(true);
    loopStateRef.current = null; // Clear any old state

    // Add user message to UI
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message.content,
      parts: [{ type: 'text', text: message.content }],
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    const modeConfig = getModeConfig(mode);
    const maxSteps = modeConfig.maxSteps || 5;

    // Build context logic... (omitted for brevity, same as before)
    // Redone context logic here to be safe and complete:
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

    // Prepare API messages history
    const apiMessages: ApiMessage[] = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
    apiMessages.push({ role: 'user', content: contextPrefix + message.content });

    // Start Loop
    await runAgentLoop(apiMessages, 0, maxSteps, [], enableWebSearch);

  }, [messages, mode, connectionId, runAgentLoop]);

  // Confirm SQL execution
  const confirmSql = useCallback(async () => {
    if (!pendingConfirmation || !loopStateRef.current) {
        setPendingConfirmation(null);
        return;
    }

    const { apiMessages, step, maxSteps, pendingToolCalls, approvedToolIds } = loopStateRef.current;
    
    // Add the confirmed tool ID to approval whitelist
    const updatedApprovedIds = [...approvedToolIds, pendingConfirmation.toolCallId];

    setPendingConfirmation(null);
    setIsLoading(true);

    // Resume loop with whitelist
    await runAgentLoop(apiMessages, step, maxSteps, pendingToolCalls, false, updatedApprovedIds);

  }, [pendingConfirmation, runAgentLoop]);

  // Reject SQL
  const rejectSql = useCallback(async (reason: string) => {
    if (!pendingConfirmation || !loopStateRef.current) {
        setPendingConfirmation(null);
        return;
    }

    const { apiMessages, step, maxSteps, pendingToolCalls, approvedToolIds } = loopStateRef.current;
    
    // Identify the specific tool call being rejected
    const rejectedToolId = pendingConfirmation.toolCallId;
    
    // Update UI for the rejected tool ONLY
    setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx < 0) return prev;
        
        const lastMsg = { ...updated[lastIdx] };
        const parts = [...(lastMsg.parts || [])];
        
        const partIdx = parts.findIndex(p => p.type === 'tool-invocation' && p.toolCallId === rejectedToolId);
        if (partIdx >= 0) {
            parts[partIdx] = { 
                ...parts[partIdx], 
                status: 'error', 
                result: { error: `Rejected: ${reason}` } 
            };
        }

        lastMsg.parts = parts;
        updated[lastIdx] = lastMsg;
        return updated;
    });

    // Add rejection result to history
    const nextApiMessages = [...apiMessages];
    nextApiMessages.push({
        role: 'tool',
        content: JSON.stringify({ error: `User rejected execution: ${reason}` }),
        toolCallId: rejectedToolId
    });

    // Remove the rejected tool from pending execution list
    const remainingToolCalls = pendingToolCalls.filter(tc => tc.id !== rejectedToolId);

    setPendingConfirmation(null);
    setIsLoading(true);

    // Resume loop with remaining tools
    // If there are still pending tools, runAgentLoop will execute them (checking for other confirmations).
    // If no tools left, it will proceed to next generation step.
    await runAgentLoop(nextApiMessages, step, maxSteps, remainingToolCalls, false, approvedToolIds);

  }, [pendingConfirmation, runAgentLoop]);

  const reload = useCallback(async () => {
    if (messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setMessages(prev => prev.slice(0, -1));
      await append({ role: 'user', content: lastUserMsg.content });
    }
  }, [messages, append]);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    loopStateRef.current = null;
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
