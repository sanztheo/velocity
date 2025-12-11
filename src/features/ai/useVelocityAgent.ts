// Velocity AI Agent Hook
// Core hook for chat functionality with client-side tool execution

import { useState, useCallback, useMemo } from 'react';
import { createAIProvider, hasAnyProvider } from './providers';
import { 
  executeDatabaseSchemaTool,
  executeSqlQueryTool,
  executeExplainTool,
  isSqlMutation,
  velocityToolDefinitions
} from './tools';
import { useAISettingsStore } from './ai-settings.store';
import type { AgentMode, PendingSqlConfirmation } from './types';

// Simple message type for our UI
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: MessagePart[];
  createdAt: Date;
}

interface MessagePart {
  type: 'text' | 'reasoning' | 'tool-invocation';
  content?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status?: 'pending' | 'executing' | 'success' | 'error';
  error?: string;
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

Your capabilities:
1. **Schema Analysis**: Use get_database_schema to understand the database structure
2. **Query Execution**: Use run_sql_query to execute SQL queries
3. **Query Optimization**: Use explain_query to analyze query performance

Guidelines:
- Always start by understanding the schema using get_database_schema when asked about the database
- Write clean, efficient SQL following best practices
- For data modifications, explain what the query will do before executing
- Provide helpful explanations alongside query results
- Suggest indexes or optimizations when you notice performance issues
- Handle errors gracefully and suggest fixes

Important:
- Be concise but informative
- Format SQL queries in code blocks
- When showing results, summarize large datasets
- Always double-check table and column names from the schema`;

export function useVelocityAgent({ connectionId, mode }: UseVelocityAgentOptions): UseVelocityAgentReturn {
  const settings = useAISettingsStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingSqlConfirmation | null>(null);
  const [pendingResolve, setPendingResolve] = useState<{
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const hasProvider = useMemo(() => hasAnyProvider(settings), [settings]);

  const currentProvider = useMemo(() => {
    if (settings.grokApiKey) return 'Grok';
    if (settings.openaiApiKey) return 'OpenAI';
    if (settings.geminiApiKey) return 'Gemini';
    return 'None';
  }, [settings]);

  // Generate unique ID
  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Execute a tool call
  const executeTool = useCallback(async (
    toolName: string, 
    args: Record<string, unknown>
  ): Promise<unknown> => {
    switch (toolName) {
      case 'get_database_schema':
        return await executeDatabaseSchemaTool(connectionId);
      case 'run_sql_query': {
        const sql = args.sql as string;
        
        // Check if mutation and needs confirmation
        if (isSqlMutation(sql) && !settings.autoAcceptSql) {
          return new Promise((resolve, reject) => {
            setPendingConfirmation({
              toolCallId: generateId(),
              sql,
              isMutation: true,
            });
            setPendingResolve({ resolve, reject });
          });
        }
        
        return await executeSqlQueryTool(connectionId, sql);
      }
      case 'explain_query':
        return await executeExplainTool(connectionId, args.sql as string);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }, [connectionId, settings.autoAcceptSql]);

  // Main chat function
  const append = useCallback(async (message: { role: 'user'; content: string }) => {
    if (!hasProvider) {
      setError(new Error('No AI provider configured'));
      return;
    }

    setIsLoading(true);
    setError(undefined);

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message.content,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const model = createAIProvider(settings, mode);
      
      // Import streaming function dynamically
      const { streamText } = await import('ai');
      
      // Build conversation history for context
      const conversationMessages = messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
      conversationMessages.push({ role: 'user', content: message.content });

      // Create assistant message placeholder
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        parts: [],
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Stream response - using AI SDK v5 API
      const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: conversationMessages,
        tools: velocityToolDefinitions,
        // maxToolRoundtrips can be used to limit tool iterations if needed
        onStepFinish: async (step) => {
          // Handle tool calls - use 'input' for AI SDK v5 instead of 'args'
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              // Cast toolCall to access properties safely
              const tc = toolCall as { toolName: string; input?: Record<string, unknown>; args?: Record<string, unknown> };
              const toolArgs = tc.input || tc.args || {};
              
              // Add tool invocation to message parts
              const toolPart: MessagePart = {
                type: 'tool-invocation',
                toolName: tc.toolName,
                args: toolArgs,
                status: 'executing',
              };

              setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg.role === 'assistant') {
                  lastMsg.parts = [...(lastMsg.parts || []), toolPart];
                }
                return updated;
              });

              try {
                const toolResult = await executeTool(tc.toolName, toolArgs);
                
                // Update tool status
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === 'assistant' && lastMsg.parts) {
                    const part = lastMsg.parts.find(
                      p => p.type === 'tool-invocation' && p.toolName === tc.toolName
                    );
                    if (part) {
                      part.status = 'success';
                      part.result = toolResult;
                    }
                  }
                  return updated;
                });
              } catch (toolError) {
                // Update tool with error
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === 'assistant' && lastMsg.parts) {
                    const part = lastMsg.parts.find(
                      p => p.type === 'tool-invocation' && p.toolName === tc.toolName
                    );
                    if (part) {
                      part.status = 'error';
                      part.error = toolError instanceof Error ? toolError.message : 'Tool failed';
                    }
                  }
                  return updated;
                });
              }
            }
          }
        },
      });

      // Collect streamed text
      let fullText = '';
      for await (const textPart of result.textStream) {
        fullText += textPart;
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullText;
            // Add text part
            const existingTextPart = lastMsg.parts?.find(p => p.type === 'text');
            if (existingTextPart) {
              existingTextPart.content = fullText;
            } else {
              lastMsg.parts = [...(lastMsg.parts || []), { type: 'text', content: fullText }];
            }
          }
          return updated;
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Chat failed'));
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.content !== '' || m.parts?.length));
    } finally {
      setIsLoading(false);
    }
  }, [hasProvider, settings, mode, messages, executeTool]);

  // Confirm pending SQL
  const confirmSql = useCallback(async () => {
    if (!pendingConfirmation || !pendingResolve) return;

    try {
      const result = await executeSqlQueryTool(connectionId, pendingConfirmation.sql);
      pendingResolve.resolve(result);
    } catch (err) {
      pendingResolve.reject(err instanceof Error ? err : new Error('Execution failed'));
    } finally {
      setPendingConfirmation(null);
      setPendingResolve(null);
    }
  }, [connectionId, pendingConfirmation, pendingResolve]);

  // Reject pending SQL
  const rejectSql = useCallback(async (reason: string) => {
    if (!pendingResolve) return;

    pendingResolve.resolve({
      success: false,
      errorMessage: `User rejected execution: ${reason}`,
      errorHint: 'Consider modifying the query based on user feedback.',
    });
    
    setPendingConfirmation(null);
    setPendingResolve(null);
  }, [pendingResolve]);

  const reload = useCallback(async () => {
    // Remove last assistant message and retry
    setMessages(prev => {
      const filtered = prev.slice(0, -1);
      if (filtered.length > 0 && filtered[filtered.length - 1].role === 'user') {
        return filtered.slice(0, -1);
      }
      return filtered;
    });
  }, []);

  const stop = useCallback(() => {
    // TODO: Implement abort controller for streaming
    setIsLoading(false);
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

// Export tool definitions for reference
export { velocityToolDefinitions };
