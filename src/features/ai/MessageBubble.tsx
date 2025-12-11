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
  return (
    <div
      className={cn(
        "px-4 py-4", 
        isUser ? "bg-transparent" : "border-b border-border/50"
      )}
    >
      {/* Message Content - Interleaved Parts */}
      {parts.length > 0 ? (
        parts.map((part, i) => {
          // Reasoning Block
          if (part.type === 'reasoning') {
            return (
              <ThinkingProcess 
                key={`reasoning-${i}`} 
                content={(part as { content: string }).content} 
              />
            );
          }

          // Tool Invocation
          if (part.type === 'tool-invocation' || part.type.startsWith('tool-')) {
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
          }

          // Text Content (Default)
          if (part.type === 'text') {
            const textContent = (part.content || '');
            if (!textContent) return null;

            return (
              isUser ? (
                <div key={`text-${i}`} className="group mt-1 flex w-full flex-row items-start gap-2">
                  <div className="relative flex grow flex-col items-stretch">
                    <div className="grow rounded-lg border border-border/10 bg-muted/20 p-2">
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:not(pre):not(code)]:text-[0.813rem]">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            pre: ({ children }) => (
                              <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2">
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
                <div key={`text-${i}`} className="prose prose-sm dark:prose-invert max-w-none [&>*:not(pre):not(code)]:text-[0.813rem] mb-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ children }) => (
                        <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2">
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
          }
          
          return null;
        })
      ) : (
        // Fallback for flat message content (no parts)
        message.content && (
          isUser ? (
             <div className="group mt-1 flex w-full flex-row items-start gap-2">
              <div className="relative flex grow flex-col items-stretch">
                <div className="grow rounded-lg border border-border/10 bg-muted/20 p-2">
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:not(pre):not(code)]:text-[0.813rem]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:not(pre):not(code)]:text-[0.813rem]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )
        )
      )}
    </div>
  );
}
