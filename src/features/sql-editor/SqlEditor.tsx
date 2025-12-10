import { useEffect, useState, useCallback } from 'react';
import { useSqlEditor } from './useSqlEditor';
import { useAiCompletion } from './useAiCompletion';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { QueryResult } from './types';
import { listTables, getTableSchema } from '@/lib/tauri';
import { useAppStore } from '@/stores/app.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Wand2, 
  History, 
  Clock, 
  Star, 
  StarOff,
  Loader2,
  AlertCircle,
  Table,
  FileQuestion,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SqlEditorProps {
  connectionId: string;
  initialSql?: string;
}

export function SqlEditor({ connectionId, initialSql = '' }: SqlEditorProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  
  const { connections, addTab } = useAppStore();
  const connection = connections.find(c => c.id === connectionId);
  const dbType = (connection?.config?.type?.toLowerCase() || 'postgresql') as 'postgresql' | 'mysql' | 'sqlite';

  const editor = useSqlEditor({ connectionId, initialSql });
  const aiCompletion = useAiCompletion({ tables, columns, dbType });

  // Load tables and columns for autocomplete
  useEffect(() => {
    const loadSchema = async () => {
      try {
        const tableList = await listTables(connectionId, 50, 0);
        setTables(tableList);

        // Load columns for each table (limit to first 10 for performance)
        const colsPromises = tableList.slice(0, 10).map(async (table) => {
          try {
            const schema = await getTableSchema(connectionId, table);
            return [table, schema.map(c => c.name)] as [string, string[]];
          } catch {
            return [table, []] as [string, string[]];
          }
        });

        const colResults = await Promise.all(colsPromises);
        setColumns(Object.fromEntries(colResults));
      } catch {
        // Connection might not be active
      }
    };

    loadSchema();
  }, [connectionId]);

  // AI suggest handler
  const handleAiSuggest = useCallback(async () => {
    if (!editor.sql.trim() || isLoadingAi) return;
    setIsLoadingAi(true);
    try {
      const suggestions = await aiCompletion.getAiSuggestions(editor.sql);
      setAiSuggestions(suggestions);
    } catch {
      setAiSuggestions([]);
    } finally {
      setIsLoadingAi(false);
    }
  }, [editor.sql, isLoadingAi, aiCompletion]);

  // Apply AI suggestion
  const applySuggestion = useCallback((suggestion: string) => {
    editor.setSql(suggestion);
    setAiSuggestions([]);
  }, [editor]);

  // Open table at specific row
  const openTableAtRow = useCallback((tableName: string, _row: unknown[], _columns: string[]) => {
    // TODO: Could add filter based on primary key to highlight the row
    addTab({
      id: `${connectionId}-${tableName}`,
      title: tableName,
      type: 'table',
      connectionId,
    });
  }, [connectionId, addTab]);

  // Render result table
  const renderResultTable = useCallback((result: QueryResult, _index: number) => {
    if (result.error) {
      return (
        <div className="flex items-center gap-2 p-4 text-red-500">
          <AlertCircle className="h-4 w-4" />
          <span>{result.error}</span>
        </div>
      );
    }

    if (result.columns.length === 0) {
      return (
        <div className="flex items-center gap-2 p-4 text-muted-foreground">
          <FileQuestion className="h-4 w-4" />
          <span>Query executed successfully. No results returned.</span>
        </div>
      );
    }

    return (
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary">
            <tr>
              {result.tableName && <th className="w-8 px-2 py-2 border-b border-border"></th>}
              {result.columns.map((col, i) => (
                <th 
                  key={i} 
                  className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIdx) => (
              <tr 
                key={rowIdx}
                className="hover:bg-secondary/50 border-b border-border/50 group"
              >
                {result.tableName && (
                  <td className="px-2 py-1">
                    <button
                      onClick={() => openTableAtRow(result.tableName!, row as unknown[], result.columns)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      title={`Open ${result.tableName}`}
                    >
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </td>
                )}
                {(row as unknown[]).map((cell, cellIdx) => (
                  <td 
                    key={cellIdx}
                    className="px-3 py-1.5 whitespace-nowrap max-w-[300px] truncate"
                  >
                    {cell === null ? (
                      <span className="text-muted-foreground italic">NULL</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [openTableAtRow]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-secondary/30">
        <Button 
          size="sm" 
          onClick={editor.execute}
          disabled={editor.isExecuting || !editor.sql.trim()}
          className="bg-green-600 hover:bg-green-700"
        >
          {editor.isExecuting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Run (⌘↵)
        </Button>

        <Button variant="outline" size="sm" onClick={editor.formatSql}>
          <Wand2 className="h-4 w-4 mr-1" />
          Format
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button 
          variant={showHistory ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="h-4 w-4 mr-1" />
          History
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleAiSuggest}
          disabled={isLoadingAi || !editor.sql.trim()}
          title="Get AI suggestions (requires OPENAI_API_KEY)"
        >
          {isLoadingAi ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1 text-purple-400" />
          )}
          AI Suggest
        </Button>

        <div className="flex-1" />

        {editor.results.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {editor.results.reduce((sum, r) => sum + r.rowCount, 0)} rows
            {' · '}
            {Math.round(editor.results.reduce((sum, r) => sum + r.executionTime, 0))}ms
          </Badge>
        )}
      </div>

      {/* AI Suggestions Panel */}
      {aiSuggestions.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-purple-500/10">
          <Sparkles className="h-3 w-3 text-purple-400 flex-shrink-0" />
          <span className="text-xs text-muted-foreground">AI Suggestions:</span>
          <div className="flex flex-wrap gap-1.5">
            {aiSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => applySuggestion(suggestion)}
                className="px-2 py-0.5 text-xs font-mono bg-purple-500/20 hover:bg-purple-500/40 rounded transition-colors max-w-[300px] truncate"
                title={suggestion}
              >
                {suggestion.length > 50 ? suggestion.slice(0, 50) + '...' : suggestion}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setAiSuggestions([])} 
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* History Panel */}
        {showHistory && (
          <div className="w-64 border-r border-border bg-secondary/20 flex flex-col">
            <div className="p-2 border-b border-border text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Query History</span>
              {editor.history.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs"
                  onClick={editor.clearHistory}
                >
                  Clear
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              {editor.history.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  No queries yet
                </div>
              ) : (
                editor.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2 border-b border-border/50 hover:bg-secondary/50 cursor-pointer group"
                    onClick={() => editor.loadFromHistory(entry)}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          editor.toggleFavorite(entry.id);
                        }}
                      >
                        {entry.favorite ? (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono truncate">{entry.sql}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.executedAt).toLocaleTimeString()}
                          <span>·</span>
                          <span>{entry.rowCount} rows</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* SQL Editor */}
          <div className="h-[200px] min-h-[100px] border-b border-border">
            <CodeMirrorEditor
              value={editor.sql}
              onChange={editor.setSql}
              onExecute={editor.execute}
              tables={tables}
              columns={columns}
              dbType={dbType}
            />
          </div>

          {/* Results */}
          <div className="flex-1 min-h-0">
            {editor.error ? (
              <div className="flex items-center gap-2 p-4 text-red-500 bg-red-500/10">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{editor.error}</span>
              </div>
            ) : editor.results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Table className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">Run a query to see results</span>
                <span className="text-xs mt-1">Press ⌘+Enter to execute</span>
              </div>
            ) : editor.results.length === 1 ? (
              <ScrollArea className="h-full">
                {renderResultTable(editor.results[0], 0)}
              </ScrollArea>
            ) : (
              <Tabs 
                value={String(editor.activeResultIndex)} 
                onValueChange={(v) => editor.setActiveResultIndex(Number(v))}
                className="h-full flex flex-col"
              >
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-secondary/30 px-2">
                  {editor.results.map((result, i) => (
                    <TabsTrigger 
                      key={i} 
                      value={String(i)}
                      className={cn(
                        "text-xs data-[state=active]:bg-background",
                        result.error && "text-red-500"
                      )}
                    >
                      {result.tableName || `Result ${i + 1}`}
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {result.rowCount}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
                {editor.results.map((result, i) => (
                  <TabsContent 
                    key={i} 
                    value={String(i)} 
                    className="flex-1 m-0 overflow-auto"
                  >
                    {renderResultTable(result, i)}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
