import { useRef, useEffect } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { sql, PostgreSQL, MySQL, SQLite } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  tables?: string[];
  columns?: Record<string, string[]>;
  dbType?: 'postgresql' | 'mysql' | 'sqlite';
  className?: string;
  readOnly?: boolean;
  height?: string;
}

// Custom dark theme matching the app design (#191919, #1F1F1F)
const customDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#191919',
    color: '#D1D1D1',
    height: '100%',
    fontSize: '13px',
  },
  '.cm-content': {
    caretColor: '#7C3AED',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#7C3AED',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#2A2A2A',
  },
  '.cm-panels': {
    backgroundColor: '#1F1F1F',
    color: '#D1D1D1',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid #2A2A2A',
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: '1px solid #2A2A2A',
  },
  '.cm-searchMatch': {
    backgroundColor: '#7C3AED33',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: '#7C3AED66',
  },
  '.cm-activeLine': {
    backgroundColor: '#1F1F1F',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#2A2A2A',
  },
  '.cm-gutters': {
    backgroundColor: '#191919',
    color: '#7D7D7D',
    border: 'none',
    borderRight: '1px solid #2A2A2A',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1F1F1F',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#2A2A2A',
    border: 'none',
    color: '#7D7D7D',
  },
  '.cm-tooltip': {
    backgroundColor: '#1F1F1F',
    border: '1px solid #2A2A2A',
    color: '#D1D1D1',
  },
  '.cm-tooltip .cm-tooltip-arrow:before': {
    borderTopColor: '#2A2A2A',
    borderBottomColor: '#2A2A2A',
  },
  '.cm-tooltip .cm-tooltip-arrow:after': {
    borderTopColor: '#1F1F1F',
    borderBottomColor: '#1F1F1F',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: '#2A2A2A',
      color: '#D1D1D1',
    },
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
}, { dark: true });

// Syntax highlighting
const customHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7C3AED' },
  { tag: tags.operator, color: '#7D7D7D' },
  { tag: tags.special(tags.variableName), color: '#E879F9' },
  { tag: tags.typeName, color: '#22D3EE' },
  { tag: tags.atom, color: '#22D3EE' },
  { tag: tags.number, color: '#F472B6' },
  { tag: tags.definition(tags.variableName), color: '#D1D1D1' },
  { tag: tags.string, color: '#4ADE80' },
  { tag: tags.special(tags.string), color: '#4ADE80' },
  { tag: tags.comment, color: '#7D7D7D', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#D1D1D1' },
  { tag: tags.tagName, color: '#E879F9' },
  { tag: tags.attributeName, color: '#22D3EE' },
  { tag: tags.className, color: '#22D3EE' },
  { tag: tags.propertyName, color: '#7C3AED' },
  { tag: tags.punctuation, color: '#7D7D7D' },
  { tag: tags.bracket, color: '#7D7D7D' },
]);

export function CodeMirrorEditor({
  value,
  onChange,
  onExecute,
  tables = [],
  columns = {},
  dbType = 'postgresql',
  className = '',
  readOnly = false,
  height,
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

  useEffect(() => {
    if (!containerRef.current) return;

    // Build schema for SQL autocomplete
    const schema: Record<string, string[]> = {};
    tables.forEach(table => {
      schema[table] = columns[table] || [];
    });

    // Create extensions
    const extensions = [
      basicSetup,
      customDarkTheme,
      syntaxHighlighting(customHighlightStyle),
      sql({ 
        dialect: getDialect(),
        schema: schema,
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorState.readOnly.of(readOnly),
    ];

    if (onExecute) {
      extensions.push(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onExecute();
              return true;
            },
          },
        ])
      );
    }

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
  // Recreate when dbType, tables, columns or readOnly change
  }, [dbType, tables, columns, readOnly, onExecute]);

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
      className={`w-full overflow-hidden rounded-md border border-[#2A2A2A] bg-[#191919] ${className}`}
      style={{ height: height || '100%' }}
    />
  );
}

