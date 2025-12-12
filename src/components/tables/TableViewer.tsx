import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getTableSchema, getTableData, executeChanges, ColumnInfo, TableData } from '@/lib/tauri';
import { useTableEditor } from '@/hooks/useTableEditor';
import { EditableCell } from './EditableCell';
import { SqlPreviewModal } from './SqlPreviewModal';
import { ForeignKeysPanel } from './ForeignKeysPanel';
import { Loader2, Plus, Trash2, Save, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TableViewerProps {
  connectionId: string;
  tableName: string;
}

const ROW_HEIGHT = 35;
const PAGE_SIZE = 100;

export function TableViewer({ connectionId, tableName }: TableViewerProps) {
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Find primary key column
  const primaryKeyColumn = useMemo(() => {
    const pk = schema.find(col => col.isPrimaryKey);
    return pk?.name || schema[0]?.name || null;
  }, [schema]);

  // Table editor state
  const editor = useTableEditor(primaryKeyColumn);

  // Column widths (based on data type)
  const columnWidths = useMemo(() => {
    return schema.map(col => {
      const type = col.dataType.toLowerCase();
      if (type.includes('text') || type.includes('varchar')) return 200;
      if (type.includes('uuid')) return 280;
      if (type.includes('timestamp')) return 180;
      if (type.includes('bool')) return 80;
      if (type.includes('int') || type.includes('numeric')) return 100;
      return 150;
    });
  }, [schema]);

  // Virtual rows
  const rowVirtualizer = useVirtualizer({
    count: (data?.rows.length || 0) + editor.newRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [connectionId, tableName, page]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schemaResult, dataResult] = await Promise.all([
        getTableSchema(connectionId, tableName),
        getTableData(connectionId, tableName, PAGE_SIZE, page * PAGE_SIZE)
      ]);
      setSchema(schemaResult);
      setData(dataResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Get primary key value for a row
  const getRowId = useCallback((rowIndex: number): string => {
    if (!data || !primaryKeyColumn) return String(rowIndex);
    const colIndex = data.columns.indexOf(primaryKeyColumn);
    if (colIndex === -1) return String(rowIndex);
    return String(data.rows[rowIndex]?.[colIndex] ?? rowIndex);
  }, [data, primaryKeyColumn]);

  // Get column data type
  const getColumnType = useCallback((columnName: string): string => {
    return schema.find(c => c.name === columnName)?.dataType || 'text';
  }, [schema]);

  // Handle cell navigation
  const handleNavigate = useCallback((
    rowIndex: number,
    colIndex: number,
    direction: 'left' | 'right' | 'up' | 'down'
  ) => {
    const numCols = data?.columns.length || 0;
    const numRows = data?.rows.length || 0;

    let newRow = rowIndex;
    let newCol = colIndex;

    switch (direction) {
      case 'left':
        newCol = Math.max(0, colIndex - 1);
        break;
      case 'right':
        newCol = Math.min(numCols - 1, colIndex + 1);
        break;
      case 'up':
        newRow = Math.max(0, rowIndex - 1);
        break;
      case 'down':
        newRow = Math.min(numRows - 1, rowIndex + 1);
        break;
    }

    if (newRow !== rowIndex || newCol !== colIndex) {
      const column = data?.columns[newCol];
      if (column) {
        editor.startEditing(newRow, column);
      }
    }
  }, [data, editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S to commit
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (editor.hasChanges) {
          setShowSqlPreview(true);
        }
      }
      // Cmd+Z to undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        editor.undoLast();
      }
      // Escape to rollback (when not editing)
      if (e.key === 'Escape' && !editor.editingCell) {
        if (editor.hasChanges) {
          editor.rollbackAll();
          toast.info('All changes discarded');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  // Handle commit
  const handleCommit = async () => {
    if (!primaryKeyColumn) {
      toast.error('Cannot commit: No primary key column found');
      return;
    }

    setIsCommitting(true);
    try {
      // Convert pending changes to the format expected by backend
      const backendChanges = editor.pendingChanges.map(change => ({
        rowId: change.rowId,
        column: change.column,
        oldValue: change.oldValue,
        newValue: change.newValue,
        type: change.type,
      }));

      // Add new rows as inserts
      editor.newRows.forEach(newRow => {
        Object.entries(newRow.values).forEach(([column, value]) => {
          if (value !== null) {
            backendChanges.push({
              rowId: newRow.tempId,
              column,
              oldValue: null,
              newValue: value,
              type: 'insert' as const,
            });
          }
        });
      });

      const result = await executeChanges(
        connectionId,
        tableName,
        primaryKeyColumn,
        backendChanges
      );

      if (result.success) {
        toast.success(`${result.rowsAffected} row${result.rowsAffected !== 1 ? 's' : ''} affected`);
        editor.rollbackAll();
        setShowSqlPreview(false);
        loadData(); // Reload data
      } else {
        toast.error(`Commit failed: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      toast.error(`Commit failed: ${err}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Add new row
  const handleAddRow = () => {
    const defaultValues: Record<string, unknown> = {};
    schema.forEach(col => {
      defaultValues[col.name] = null;
    });
    editor.addNewRow(defaultValues);
    toast.info('New row added');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading table data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        <p>Error loading table: {error}</p>
        <Button variant="outline" onClick={loadData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-2 border-b border-border bg-secondary/30 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleAddRow}>
          <Plus className="h-4 w-4 mr-1" />
          Add Row
        </Button>

        {editor.hasChanges && (
          <>
            <div className="h-4 w-px bg-border mx-2" />
            <Badge variant="secondary" className="text-xs">
              {editor.changeCount} pending change{editor.changeCount !== 1 ? 's' : ''}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSqlPreview(true)}
              className="text-green-500 border-green-500/50 hover:bg-green-500/10"
            >
              <Save className="h-4 w-4 mr-1" />
              Commit (⌘S)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                editor.rollbackAll();
                toast.info('Changes discarded');
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Discard
            </Button>
          </>
        )}

        <div className="flex-1" />

        {/* Column info */}
        <div className="text-xs text-muted-foreground">
          {schema.length} columns
        </div>
      </div>

      {/* Foreign Keys Panel */}
      <ForeignKeysPanel connectionId={connectionId} tableName={tableName} />

      {/* Table container with virtual scrolling */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex bg-background border-b border-border"
          style={{ width: totalWidth }}
        >
          {data?.columns.map((col, colIdx) => {
            const colInfo = schema.find(s => s.name === col);
            return (
              <div
                key={col}
                className="flex items-center px-2 py-2 font-semibold text-sm border-r border-border last:border-r-0 bg-secondary/50"
                style={{ width: columnWidths[colIdx], minWidth: columnWidths[colIdx] }}
              >
                <span className="truncate">{col}</span>
                {colInfo?.isPrimaryKey && (
                  <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                    PK
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Virtual rows container */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: totalWidth,
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const rowIndex = virtualRow.index;
            const isNewRow = rowIndex >= (data?.rows.length || 0);
            const isDeleted = editor.isRowDeleted(rowIndex);

            // Get row data
            const rowData = isNewRow
              ? Object.values(editor.newRows[rowIndex - (data?.rows.length || 0)]?.values || {})
              : data?.rows[rowIndex] || [];

            const rowId = isNewRow
              ? editor.newRows[rowIndex - (data?.rows.length || 0)]?.tempId || ''
              : getRowId(rowIndex);

            return (
              <div
                key={virtualRow.key}
                className={cn(
                  'absolute flex border-b border-border/50 hover:bg-secondary/30',
                  isNewRow && 'bg-green-500/10',
                  isDeleted && 'bg-red-500/10'
                )}
                style={{
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {data?.columns.map((col, colIdx) => {
                  const cellValue = rowData[colIdx];
                  const isEditing = editor.editingCell?.rowIndex === rowIndex && editor.editingCell?.column === col;
                  const change = editor.getCellChange(rowIndex, col);
                  const displayValue = change ? change.newValue : cellValue;

                  return (
                    <div
                      key={col}
                      className="border-r border-border/30 last:border-r-0"
                      style={{ width: columnWidths[colIdx], minWidth: columnWidths[colIdx] }}
                    >
                      <EditableCell
                        value={displayValue}
                        column={col}
                        dataType={getColumnType(col)}
                        isEditing={isEditing}
                        isModified={!!change}
                        isDeleted={isDeleted}
                        connectionId={connectionId}
                        tableName={tableName}
                        onStartEdit={() => editor.startEditing(rowIndex, col)}
                        onSave={(newValue) => {
                          if (isNewRow) {
                            editor.updateNewRow(rowId, col, newValue);
                          } else {
                            editor.updateCell(rowIndex, rowId, col, cellValue, newValue);
                          }
                        }}
                        onCancel={() => editor.stopEditing()}
                        onNavigate={(dir) => handleNavigate(rowIndex, colIdx, dir)}
                      />
                    </div>
                  );
                })}

                {/* Row actions (delete) */}
                {!isNewRow && (
                  <div className="absolute right-0 top-0 bottom-0 flex items-center opacity-0 hover:opacity-100 bg-gradient-to-l from-background to-transparent px-2">
                    {isDeleted ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => editor.undeleteRow(rowIndex)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-600"
                        onClick={() => editor.deleteRow(rowIndex, rowId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data?.rows.length === 0 && editor.newRows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No data in this table
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="p-3 border-t border-border bg-secondary/30 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + (data?.rows.length || 0)} rows
          {editor.newRows.length > 0 && (
            <span className="text-green-500 ml-2">
              (+{editor.newRows.length} new)
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={(data?.rows.length || 0) < PAGE_SIZE}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* SQL Preview Modal */}
      <SqlPreviewModal
        open={showSqlPreview}
        onClose={() => setShowSqlPreview(false)}
        onConfirm={handleCommit}
        sql={editor.generateSqlPreview(tableName)}
        changeCount={editor.changeCount}
        isExecuting={isCommitting}
      />
    </div>
  );
}
