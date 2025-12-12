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
        "px-4 py-4",
        isUser ? "bg-transparent" : "border-b border-border/50"
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
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap [&>*:not(pre):not(code)]:text-[0.813rem]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {textContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div key={`text-${i}`} className="prose prose-sm dark:prose-invert max-w-none min-w-0 break-words whitespace-pre-wrap [&>*:not(pre):not(code)]:text-[0.813rem]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => (
                      <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2 whitespace-pre-wrap break-all">
                        {children}
                      </pre>
                    ),
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="bg-muted px-1 py-0.5 rounded text-sm break-all" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return <code className={cn(className, "break-all")} {...props}>{children}</code>;
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
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap [&>*:not(pre):not(code)]:text-[0.813rem]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none min-w-0 break-words whitespace-pre-wrap [&>*:not(pre):not(code)]:text-[0.813rem]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => (
                    <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2 whitespace-pre-wrap break-all">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-muted px-1 py-0.5 rounded text-sm break-all" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return <code className={cn(className, "break-all")} {...props}>{children}</code>;
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
