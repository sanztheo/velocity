// Velocity AI Agent Hook
// Core hook for chat functionality with client-side tool execution

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createAIProviderAsync } from './providers';
import { 
  executeDatabaseSchemaTool,
  executeSqlQueryTool,
  executeExplainTool,
  executeListTablesTool,
  executeGetTablePreviewTool,
  executeGetTableSchemaTool,
  executeGetTableIndexesTool,
  executeGetTableForeignKeysTool,
  executeValidateSqlTool,
  executeCreateTableTool,
  executeDdlTool,
  executeGenerateInsertTemplateTool,
  isSqlMutation,
  velocityToolDefinitions
} from './tools';
import { useAISettingsStore, hasAnyProviderAvailable, getBestProvider } from './ai-settings.store';
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
  type: 'text' | 'reasoning' | 'tool-invocation' | 'thinking';
  content?: string;
  toolCallId?: string; // Added ID for dedup
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

<communication>
1. Be concise and do not repeat yourself.
2. Be conversational but professional.
3. Refer to the USER in the second person and yourself in the first person.
4. Format your responses in markdown. Use backticks to format table, column, and SQL keywords.
5. NEVER lie or make things up.
6. When explaining complex concepts or optimizations, consider using an "Insight" block:
   \`★ Insight ─────────────────────────────────────\`
   [2-3 key educational points about the query plan or DB design]
   \`─────────────────────────────────────────────────\`
</communication>

<tool_calling>
You have tools at your disposal to interact with the database. Follow these rules:
1. **Always analyze the schema first**: Before writing queries for tables you haven't seen, use \`get_database_schema\`.
2. **Explain before acting**: Briefly explain to the USER why you are calling a tool before you call it.
3. **Optimized Queries**: Always write clean, efficient, and standard SQL.
4. **Safety First**: For data modification (INSERT, UPDATE, DELETE, DROP, ALTER), you must explain the impact clearly.
5. **No Hallucinations**: Do not assume table names. Check the schema.
</tool_calling>

<thinking_process>
Your output is rendered in an interleaved stream of thoughts and tool results.
1. When you need to think or plan, produce a response in your normal text stream describing your plan.
2. Then execute the tool.
3. Then analyze the tool result in a new thought block/text stream.
4. Finally provide the answer.
The user sees this as a natural flow: Thought -> Action -> Result -> Observation -> Answer.
</thinking_process>

<capabilities>
1. **Schema Analysis**: Use \`get_database_schema\` to understand the database structure.
2. **Query Execution**: Use \`run_sql_query\` to execute SQL queries.
3. **Query Optimization**: Use \`explain_query\` to analyze query performance.
4. **Data Inspection**: Use \`list_tables\`, \`preview_table\` for quick lookups.
5. **Modification**: Use \`execute_ddl\` or \`run_sql_query\` for changes (these will require user confirmation).
</capabilities>

<formatting>
- Format SQL queries in code blocks with the language set to \`sql\`.
- When showing results, summarize large datasets; don't dump raw JSON unless asked.
- Use explicit column references (e.g., \`table.column\`) in complex joins.
</formatting>`;

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

  // Load env keys on mount
  useEffect(() => {
    settings.loadEnvKeys();
  }, []);

  const hasProvider = useMemo(() => hasAnyProviderAvailable(settings), [settings]);

  const currentProvider = useMemo(() => {
    // If we have a preferred provider and it has a key (or is available in env), use it
    if (settings.preferredProvider) {
      if (settings.preferredProvider === 'grok' && (settings.grokApiKey || settings.envKeysStatus?.grokAvailable)) return 'Grok';
      if (settings.preferredProvider === 'openai' && (settings.openaiApiKey || settings.envKeysStatus?.openaiAvailable)) return 'OpenAI';
      if (settings.preferredProvider === 'gemini' && (settings.geminiApiKey || settings.envKeysStatus?.geminiAvailable)) return 'Gemini';
    }

    // Otherwise show the best available one
    const best = getBestProvider(settings);
    if (best === 'grok') return 'Grok';
    if (best === 'openai') return 'OpenAI';
    if (best === 'gemini') return 'Gemini';
    
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
      // Core tools
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
      
      // Table exploration tools  
      case 'list_tables':
        return await executeListTablesTool(connectionId);
      
      case 'get_table_preview':
        return await executeGetTablePreviewTool(
          connectionId, 
          args.tableName as string, 
          (args.limit as number) || 10
        );
      
      case 'get_table_schema':
        return await executeGetTableSchemaTool(connectionId, args.tableName as string);
      
      case 'get_table_indexes':
        return await executeGetTableIndexesTool(connectionId, args.tableName as string);
      
      case 'get_table_foreign_keys':
        return await executeGetTableForeignKeysTool(connectionId, args.tableName as string);
      
      // SQL validation
      case 'validate_sql':
        return await executeValidateSqlTool(connectionId, args.sql as string);
      
      // Schema modification tools (require confirmation for DDL)
      case 'create_table': {
        const columns = args.columns as Array<{
          name: string;
          dataType: string;
          isNullable?: boolean;
          isPrimaryKey?: boolean;
          defaultValue?: string;
        }>;
        
        // Build the SQL for confirmation display
        const columnDefs = columns.map(col => {
          let def = `"${col.name}" ${col.dataType}`;
          if (col.isPrimaryKey) def += ' PRIMARY KEY';
          if (!col.isNullable && !col.isPrimaryKey) def += ' NOT NULL';
          if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
          return def;
        }).join(', ');
        const sql = `CREATE TABLE "${args.tableName}" (${columnDefs})`;
        
        // DDL always needs confirmation unless auto-accept
        if (!settings.autoAcceptSql) {
          return new Promise((resolve, reject) => {
            setPendingConfirmation({
              toolCallId: generateId(),
              sql,
              isMutation: true,
            });
            setPendingResolve({ resolve, reject });
          });
        }
        
        return await executeCreateTableTool(connectionId, args.tableName as string, columns);
      }
      
      case 'execute_ddl': {
        const sql = args.sql as string;
        
        // DDL always needs confirmation unless auto-accept
        if (!settings.autoAcceptSql) {
          return new Promise((resolve, reject) => {
            setPendingConfirmation({
              toolCallId: generateId(),
              sql,
              isMutation: true,
            });
            setPendingResolve({ resolve, reject });
          });
        }
        
        return await executeDdlTool(connectionId, sql);
      }
      
      // Helper tools
      case 'generate_insert_template':
        return await executeGenerateInsertTemplateTool(connectionId, args.tableName as string);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }, [connectionId, settings.autoAcceptSql]);

  // Main chat loop function
  const runAI = useCallback(async (currentMessages: ChatMessage[]) => {
    if (!hasProvider) return; // Should allow user to see error if no provider

    try {
      setIsLoading(true);
      const model = await createAIProviderAsync(mode);
      const { streamText } = await import('ai');
      
      // Convert to AI SDK Format
      const conversationMessages = currentMessages.map(m => {
        // Simple conversion - for complex history with multiple tool calls, 
        // we might need more robust mapping if we were storing them differently.
        // But here we store them in 'parts' which we can flatten or sending text content.
        // For SDK v5, we should pass the 'tool-result' messages correctly.
        // Since we are building a custom UI flow, let's keep it simple: 
        // construct messages from parts if available.
        
        let content: any = m.content;
        
        // If we have parts (our internal structure), try to format for AI SDK?
        // Actually, AI SDK v5 handles its own message format.
        // We are mixing our UI 'ChatMessage' with AI SDK messages.
        // Let's rely on content text for now for simplicity, OR robustly map parts.
        
        // Simple text-based approach for non-tool parts:
        return {
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        };
      });

      // Track executed tool IDs for this single turn
      // (Removed executedToolIds as we handle tools via stream)

      const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: conversationMessages,
        tools: velocityToolDefinitions,
        // We handle everything in fullStream loop
      });

      // Stream parts to UI in order
      // Add initial "thinking" state
      setMessages(prev => {
        const updated = [...prev];
        const lastMsgIndex = updated.length - 1;
        const lastMsg = { ...updated[lastMsgIndex] };
        updated[lastMsgIndex] = lastMsg;
        lastMsg.parts = [{ type: 'thinking', content: '' }]; // Placeholder for loading state
        return updated;
      });

      for await (const part of result.fullStream) {
        setMessages(prev => {
          const updated = [...prev];
          const lastMsgIndex = updated.length - 1;
          const lastMsg = { ...updated[lastMsgIndex] }; // Clone message
          updated[lastMsgIndex] = lastMsg;

          if (!lastMsg.parts) lastMsg.parts = [];
          
          // Clone parts array because we might push to it or modify an item
          const parts = [...lastMsg.parts];
          lastMsg.parts = parts;
          
          // Remove placeholder "thinking" part if real content arrives (except reasoning-delta where we keep thinking until content comes)
          if (parts.length === 1 && parts[0].type === 'thinking' && part.type !== 'reasoning-delta') {
            parts.shift();
          }
          
          const lastPartIndex = parts.length - 1;
          const lastPart = lastPartIndex >= 0 ? { ...parts[lastPartIndex] } : null; // Clone last part to modify safely

          switch (part.type) {
            case 'text-delta': {
              const text = (part as any).textDelta || (part as any).text || '';
              
              if (lastPart && lastPart.type === 'text') {
                lastPart.content = (lastPart.content || '') + text;
                parts[lastPartIndex] = lastPart; // Update array with modified clone
              } else {
                parts.push({ type: 'text', content: text });
              }
              lastMsg.content = (lastMsg.content || '') + text;
              break;
            }

            case 'tool-call': {
              const toolPart: MessagePart = {
                type: 'tool-invocation',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: (part as any).args, 
                status: 'executing',
              };
              parts.push(toolPart);
              break;
            }
            
            // extractReasoningMiddleware emits 'reasoning' type parts with 'text' property
            // @ts-ignore - SDK types may vary
            case 'reasoning':
            // @ts-ignore
            case 'reasoning-delta': {
              // @ts-ignore
              const reasoningText = (part as any).text || (part as any).textDelta || (part as any).content || '';
              
              // Remove placeholder if still there
              if (parts.length > 0 && parts[0].type === 'thinking') {
                parts.shift();
              }
              
              // Find existing reasoning part or create new
              const existingReasoningIndex = parts.findIndex(p => p.type === 'reasoning');
              if (existingReasoningIndex >= 0) {
                const existingPart = { ...parts[existingReasoningIndex] };
                existingPart.content = (existingPart.content || '') + reasoningText;
                parts[existingReasoningIndex] = existingPart;
              } else {
                parts.push({ type: 'reasoning', content: reasoningText });
              }
              break;
            }
          }
          return updated;
        });
      }

      // Wait for full step usage items to settle
      const toolCalls = await result.toolCalls;

      if (toolCalls && toolCalls.length > 0) {
        // EXECUTION PHASE
        const results: any[] = [];
        let needsConfirmation = false;

        for (const toolCall of toolCalls) {
           const tc = toolCall as { toolName: string; toolCallId: string; input?: Record<string, unknown>; args?: Record<string, unknown> };
           const toolArgs = tc.input || tc.args || {};
           const toolCallId = tc.toolCallId;
           
           // Check if mutation requires confirmation
           if (
             (tc.toolName === 'run_sql_query' && isSqlMutation(toolArgs.sql as string)) ||
             tc.toolName === 'create_table' ||
             tc.toolName === 'execute_ddl'
           ) {
             if (!settings.autoAcceptSql) {
               needsConfirmation = true;
               
               setPendingConfirmation({
                 toolCallId,
                 sql: (toolArgs.sql as string) || (toolArgs.tableName ? `CREATE TABLE ${toolArgs.tableName}...` : 'DDL'),
                 isMutation: true,
               });
               
               setIsLoading(false);
               return; 
             }
           }
           
           // Execute immediately
           try {
              // Mark as executing (it might be already if stream added it)
              // But we can update status to be sure
              
              const output = await executeTool(tc.toolName, toolArgs);
              results.push({
                 toolCallId,
                 toolName: tc.toolName,
                 result: output
              });
              
              // Update UI success
              setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  const part = lastMsg.parts?.find(p => p.toolCallId === toolCallId);
                  if (part) {
                    part.status = 'success';
                    part.result = output;
                  }
                  return updated;
              });
           } catch (err: any) {
              results.push({
                 toolCallId,
                 toolName: tc.toolName,
                 error: err.message
              });
              
              // Update UI error
              setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  const part = lastMsg.parts?.find(p => p.toolCallId === toolCallId);
                  if (part) {
                    part.status = 'error';
                    part.error = err.message;
                  }
                  return updated;
              });
           }
        }

        // FEED RESULTS BACK TO AI
        if (results.length > 0) {
           // We need to construct the next message history.
           // Append tool results as a user tool block for the AI to react to
           const toolOutputBlock = `Tool Results for the above calls:\n${JSON.stringify(results, null, 2)}\n\n(Proceed with these results)`;
           
           const nextMessages = [
             ...currentMessages, 
             { role: 'assistant', content: (await result.text) || ' ' } as ChatMessage, // Use final text
             { role: 'user', content: toolOutputBlock } as ChatMessage
           ];
           
           await runAI(nextMessages);
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Chat failed'));
    } finally {
      setIsLoading(false);
    }
  }, [hasProvider, settings, mode, executeTool]);

  const append = useCallback(async (message: { role: 'user'; content: string }) => {
    if (!hasProvider) {
      setError(new Error('No AI provider configured'));
      return;
    }

    setIsLoading(true);
    setError(undefined);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message.content,
      createdAt: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Start the AI loop
    const newHistory = [...messages, userMessage];
    
    // Create placeholder for assistant response
    const assistantPlaceholder: ChatMessage = {
       id: generateId(),
       role: 'assistant',
       content: '',
       parts: [],
       createdAt: new Date()
    };
    setMessages(prev => [...prev, assistantPlaceholder]);
    
    await runAI(newHistory);
  }, [hasProvider, messages, runAI]);

  // Confirm pending SQL
  const confirmSql = useCallback(async () => {
    if (!pendingConfirmation) return;

    try {
      setIsLoading(true);
      const result = await executeSqlQueryTool(connectionId, pendingConfirmation.sql);
      
      // Update UI for the pending tool (we need to find it)
      const toolCallId = pendingConfirmation.toolCallId;
      setMessages(prev => {
        const updated = [...prev];
        // Find the message with this tool call
        for (const msg of updated) {
          const part = msg.parts?.find(p => p.toolCallId === toolCallId);
          if (part) {
            part.status = 'success';
            part.result = result;
          }
        }
        return updated;
      });

      // CONTINUE THE LOOP - Resolving confirmation finishes the user interaction part.
      // We don't auto-continue the thought process here unless requested.
      // The user can now ask "What next?" or "Show me what you did".
      
    } catch (err) {
      // Handle error...
    } finally {
      setPendingConfirmation(null);
      setIsLoading(false);
    }
  }, [connectionId, pendingConfirmation]); // Removed messages dependency as we use functional update // Added messages dependency

  // Reject pending SQL - similar update
  const rejectSql = useCallback(async (reason: string) => {
    if (!pendingConfirmation) return;
    
    const toolCallId = pendingConfirmation.toolCallId;
     setMessages(prev => {
        const updated = [...prev];
        for (const msg of updated) {
          const part = msg.parts?.find(p => p.toolCallId === toolCallId);
          if (part) {
            part.status = 'error';
            part.error = `Rejected: ${reason}`;
          }
        }
        return updated;
      });

    setPendingConfirmation(null);
  }, [pendingConfirmation]);

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
