// MessageBubble Component
// Renders a single chat message with markdown, thinking blocks, and tool calls

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { ThinkingProcess } from './ThinkingProcess';
import { ToolInvocation } from './ToolInvocation';
import type { ChatMessage, MessagePart } from './useVelocityAgent';

interface MessageBubbleProps {
  message: ChatMessage;
  onConfirm?: () => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
}

export function MessageBubble({ message, onConfirm, onReject }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const parts = message.parts || [];
  const hasPartsToRender = parts.length > 0;

  return (
    <div
      className={cn(
        "px-4 py-2",
        isUser ? "bg-transparent" : "bg-transparent"
      )}
    >
      {hasPartsToRender ? (
        parts.map((part: MessagePart, i: number) => {
          // Text Part
          if (part.type === 'text') {
            const textContent = part.text || part.content || '';
            if (!textContent) return null;

            return isUser ? (
              <div key={`text-${i}`} className="group mt-1 flex w-full flex-row items-start gap-2">
                <div className="relative flex grow flex-col items-stretch min-w-0">
                  <div className="grow rounded-lg border border-border/10 bg-muted/20 p-2 break-words">
                    <div className="max-w-none break-words whitespace-pre-wrap text-[0.813rem] leading-normal text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {textContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div key={`text-${i}`} className="max-w-none min-w-0 break-words whitespace-pre-wrap text-[0.813rem] leading-normal text-foreground">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ className, children, ...props }) => (
                      <p className={cn("mb-1 last:mb-0", className)} {...props}>
                        {children}
                      </p>
                    ),
                    a: ({ className, children, ...props }) => (
                      <a className={cn("text-primary underline underline-offset-4 hover:no-underline", className)} target="_blank" rel="noopener noreferrer" {...props}>
                        {children}
                      </a>
                    ),
                    blockquote: ({ className, children, ...props }) => (
                      <blockquote className={cn("border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-1", className)} {...props}>
                        {children}
                      </blockquote>
                    ),
                    ul: ({ className, children, ...props }) => (
                      <ul className={cn("my-1 pl-4 list-disc", className)} {...props}>
                        {children}
                      </ul>
                    ),
                    ol: ({ className, children, ...props }) => (
                      <ol className={cn("my-1 pl-4 list-decimal", className)} {...props}>
                        {children}
                      </ol>
                    ),
                    li: ({ className, children, ...props }) => (
                      <li className={cn("my-0.5", className)} {...props}>
                        {children}
                      </li>
                    ),
                    hr: () => <div className="my-2" />, // Smaller invisible spacer
                    h1: ({ className, children, ...props }) => <h1 className={cn("mt-3 mb-1 text-lg font-bold", className)} {...props}>{children}</h1>,
                    h2: ({ className, children, ...props }) => <h2 className={cn("mt-2 mb-1 text-base font-semibold", className)} {...props}>{children}</h2>,
                    h3: ({ className, children, ...props }) => <h3 className={cn("mt-2 mb-0.5 text-sm font-semibold", className)} {...props}>{children}</h3>,
                    h4: ({ className, children, ...props }) => <h4 className={cn("mt-2 mb-0.5 text-sm font-semibold", className)} {...props}>{children}</h4>,
                    h5: ({ className, children, ...props }) => <h5 className={cn("mt-2 mb-0.5 text-xs font-semibold", className)} {...props}>{children}</h5>,
                    h6: ({ className, children, ...props }) => <h6 className={cn("mt-2 mb-0.5 text-xs font-semibold", className)} {...props}>{children}</h6>,
                    table: ({ className, children, ...props }) => (
                      <div className="my-2 w-full overflow-y-auto">
                        <table className={cn("w-full border-collapse border border-border text-sm", className)} {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ className, children, ...props }) => (
                      <thead className={cn("bg-muted", className)} {...props}>{children}</thead>
                    ),
                    tbody: ({ className, children, ...props }) => (
                      <tbody className={cn("", className)} {...props}>{children}</tbody>
                    ),
                    tr: ({ className, children, ...props }) => (
                      <tr className={cn("border-b border-border last:border-0", className)} {...props}>{children}</tr>
                    ),
                    th: ({ className, children, ...props }) => (
                      <th className={cn("px-3 py-1.5 text-left font-medium text-muted-foreground border-r border-border last:border-0", className)} {...props}>{children}</th>
                    ),
                    td: ({ className, children, ...props }) => (
                      <td className={cn("px-3 py-1.5 border-r border-border last:border-0", className)} {...props}>{children}</td>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2 whitespace-pre-wrap break-all">
                        {children}
                      </pre>
                    ),
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="bg-muted px-1 py-0.5 rounded text-sm break-all font-mono text-foreground" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return <code className={cn(className, "break-all bg-transparent p-0 font-mono text-foreground")} {...props}>{children}</code>;
                    },
                  }}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            );
          }

          // Reasoning Part
          if (part.type === 'reasoning') {
            const reasoningText = part.text || part.content || '';
            if (!reasoningText) return null;
            return (
              <ThinkingProcess
                key={`reasoning-${i}`}
                content={reasoningText}
              />
            );
          }

          // Tool Invocation Part
          if (part.type === 'tool-invocation') {
            return (
              <ToolInvocation
                key={`tool-${i}`}
                toolName={part.toolName || 'unknown'}
                args={part.args || {}}
                status={part.status || 'pending'}
                result={part.result}
                onConfirm={onConfirm}
                onReject={onReject}
              />
            );
          }

          return null;
        })
      ) : (
        // Fallback to message.content if no parts
        message.content && (
          isUser ? (
            <div className="group mt-1 flex w-full flex-row items-start gap-2">
              <div className="relative flex grow flex-col items-stretch min-w-0">
                <div className="grow rounded-lg border border-border/10 bg-muted/20 p-2 break-words">
                  <div className="max-w-none break-words whitespace-pre-wrap text-[0.813rem] leading-normal text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-none min-w-0 break-words whitespace-pre-wrap text-[0.813rem] leading-normal text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ className, children, ...props }) => (
                    <p className={cn("mb-1 last:mb-0", className)} {...props}>
                      {children}
                    </p>
                  ),
                  a: ({ className, children, ...props }) => (
                    <a className={cn("text-primary underline underline-offset-4 hover:no-underline", className)} target="_blank" rel="noopener noreferrer" {...props}>
                      {children}
                    </a>
                  ),
                  blockquote: ({ className, children, ...props }) => (
                    <blockquote className={cn("border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-1", className)} {...props}>
                      {children}
                    </blockquote>
                  ),
                  ul: ({ className, children, ...props }) => (
                    <ul className={cn("my-1 pl-4 list-disc", className)} {...props}>
                      {children}
                    </ul>
                  ),
                  ol: ({ className, children, ...props }) => (
                    <ol className={cn("my-1 pl-4 list-decimal", className)} {...props}>
                      {children}
                    </ol>
                  ),
                  li: ({ className, children, ...props }) => (
                    <li className={cn("my-0.5", className)} {...props}>
                      {children}
                    </li>
                  ),
                  hr: () => <div className="my-2" />, // Smaller invisible spacer
                  h1: ({ className, children, ...props }) => <h1 className={cn("mt-3 mb-1 text-lg font-bold", className)} {...props}>{children}</h1>,
                  h2: ({ className, children, ...props }) => <h2 className={cn("mt-2 mb-1 text-base font-semibold", className)} {...props}>{children}</h2>,
                  h3: ({ className, children, ...props }) => <h3 className={cn("mt-2 mb-0.5 text-sm font-semibold", className)} {...props}>{children}</h3>,
                  h4: ({ className, children, ...props }) => <h4 className={cn("mt-2 mb-0.5 text-sm font-semibold", className)} {...props}>{children}</h4>,
                  h5: ({ className, children, ...props }) => <h5 className={cn("mt-2 mb-0.5 text-xs font-semibold", className)} {...props}>{children}</h5>,
                  h6: ({ className, children, ...props }) => <h6 className={cn("mt-2 mb-0.5 text-xs font-semibold", className)} {...props}>{children}</h6>,
                  table: ({ className, children, ...props }) => (
                    <div className="my-2 w-full overflow-y-auto">
                      <table className={cn("w-full border-collapse border border-border text-sm", className)} {...props}>
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ className, children, ...props }) => (
                    <thead className={cn("bg-muted", className)} {...props}>{children}</thead>
                  ),
                  tbody: ({ className, children, ...props }) => (
                    <tbody className={cn("", className)} {...props}>{children}</tbody>
                  ),
                  tr: ({ className, children, ...props }) => (
                    <tr className={cn("border-b border-border last:border-0", className)} {...props}>{children}</tr>
                  ),
                  th: ({ className, children, ...props }) => (
                    <th className={cn("px-3 py-1.5 text-left font-medium text-muted-foreground border-r border-border last:border-0", className)} {...props}>{children}</th>
                  ),
                  td: ({ className, children, ...props }) => (
                    <td className={cn("px-3 py-1.5 border-r border-border last:border-0", className)} {...props}>{children}</td>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2 whitespace-pre-wrap break-all">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-muted px-1 py-0.5 rounded text-sm break-all font-mono text-foreground" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return <code className={cn(className, "break-all bg-transparent p-0 font-mono text-foreground")} {...props}>{children}</code>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )
        )
      )}
    </div>
  );
}
