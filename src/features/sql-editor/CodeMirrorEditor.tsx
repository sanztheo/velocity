import { useRef, useEffect } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { sql, PostgreSQL, MySQL, SQLite } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  tables?: string[];
  columns?: Record<string, string[]>;
  dbType?: 'postgresql' | 'mysql' | 'sqlite';
  className?: string;
}

export function CodeMirrorEditor({
  value,
  onChange,
  onExecute,
  tables = [],
  columns = {},
  dbType = 'postgresql',
  className = '',
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Get dialect based on db type
  const getDialect = () => {
    switch (dbType) {
      case 'mysql': return MySQL;
      case 'sqlite': return SQLite;
      default: return PostgreSQL;
    }
  };

  // Custom autocomplete for tables and columns
  const tableColumnCompletion = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const options = [
      // Tables
      ...tables.map(table => ({
        label: table,
        type: 'class' as const,
        info: 'Table',
      })),
      // Columns for each table
      ...Object.entries(columns).flatMap(([table, cols]) =>
        cols.map(col => ({
          label: col,
          type: 'property' as const,
          info: `Column (${table})`,
        }))
      ),
    ];

    return {
      from: word.from,
      options,
    };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Create extensions
    const extensions = [
      basicSetup,
      oneDark,
      sql({ dialect: getDialect() }),
      autocompletion({ override: [tableColumnCompletion] }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onExecute();
            return true;
          },
        },
      ]),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        },
        '.cm-content': {
          caretColor: '#528bff',
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: '#528bff',
        },
      }),
    ];

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbType]); // Only recreate on dbType change

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div 
      ref={containerRef} 
      className={`h-full w-full overflow-hidden rounded-md border border-border bg-[#282c34] ${className}`}
    />
  );
}
