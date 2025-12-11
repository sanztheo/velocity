// MessageBubble Component
// Renders a single chat message with markdown, thinking blocks, and tool calls

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { ThinkingProcess } from './ThinkingProcess';
import { ToolInvocation } from './ToolInvocation';
import type { ChatMessage } from './useVelocityAgent';

interface MessagePart {
  type: string;
  content?: string;
  toolName?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status?: string;
  error?: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';


  // Extract parts from message - cast to our interface
  const parts = (message.parts || []) as MessagePart[];
  const reasoningParts = parts.filter((p: MessagePart) => p.type === 'reasoning');
  const toolParts = parts.filter((p: MessagePart) => 
    p.type === 'tool-invocation' || p.type.startsWith('tool-')
  );

  return (
    <div
      className={cn(
        "px-4 py-4", // Base padding
        isUser ? "bg-transparent" : "border-b border-border/50" // Assistant gets border separator
      )}
    >
      {/* Message header - Only for Assistant */}


      {/* Reasoning/Thinking blocks */}
      {reasoningParts.map((part, i) => (
        <ThinkingProcess 
          key={`reasoning-${i}`} 
          content={(part as { content: string }).content} 
        />
      ))}

      {/* Tool invocations */}
      {toolParts.map((part, i) => {
        const toolPart = part as {
          type: string;
          toolName?: string;
          name?: string;
          args?: Record<string, unknown>;
          result?: unknown;
          status?: string;
          error?: string;
        };
        return (
          <ToolInvocation
            key={`tool-${i}`}
            toolName={toolPart.toolName || toolPart.name || 'unknown'}
            args={toolPart.args || {}}
            status={(toolPart.status as 'pending' | 'success' | 'error') || 'success'}
            result={toolPart.result}
            error={toolPart.error}
          />
        );
      })}

      {/* Main text content - extract from text parts */}
      {(() => {
        // Extract text content from parts
        let textContent = parts
          .filter((p: MessagePart) => p.type === 'text')
          .map((p: MessagePart) => p.content || '')
          .join('');
        
        // Fallback to top-level content if no parts found (standard for simple messages)
        if (!textContent && message.content) {
          textContent = message.content;
        }
        
        if (!textContent) return null;
        
        return (
          isUser ? (
            <div className="group mt-1 flex w-full flex-row items-start gap-2">
              <div className="relative flex grow flex-col items-stretch">
                <div className="grow rounded-lg border border-border/10 bg-muted/20 p-2">
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:not(pre):not(code)]:text-[0.813rem]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Custom code block styling (same as before)
                        pre: ({ children }) => (
                          <pre className="bg-muted rounded-md p-3 overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        code: ({ className, children, ...props }) => {
                          const isInline = !className;
                          if (isInline) {
                            return (
                              <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                                {children}
                              </code>
                            );
                          }
                          return <code className={className} {...props}>{children}</code>;
                        },
                      }}
                    >
                      {textContent}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:not(pre):not(code)]:text-[0.813rem]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom code block styling
                  pre: ({ children }) => (
                    <pre className="bg-muted rounded-md p-3 overflow-x-auto">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                  // Tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="min-w-full border-collapse border border-border">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border bg-muted px-3 py-2 text-left">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-3 py-2">
                      {children}
                    </td>
                  ),
                }}
              >
                {textContent}
              </ReactMarkdown>
            </div>
          )
        );
      })()}
    </div>
  );
}
