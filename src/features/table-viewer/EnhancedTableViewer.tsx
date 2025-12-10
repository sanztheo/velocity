/**
 * Enhanced Table Viewer with Filtering, Sorting, and Pagination
 * 
 * This wrapper adds the new filter/sort/pagination features to the existing TableViewer.
 * Uses the new getTableDataFiltered API for server-side operations.
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getTableSchema, getTableDataFiltered, ColumnInfo } from '@/lib/tauri';
import { useTableEditor } from '@/hooks/useTableEditor';
import { EditableCell } from '@/components/tables/EditableCell';
import { SqlPreviewModal } from '@/components/tables/SqlPreviewModal';
import { ForeignKeysPanel } from '@/components/tables/ForeignKeysPanel';
import { Loader2, Plus, Save, RotateCcw, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { executeChanges } from '@/lib/tauri';
import { ExportDialog } from '@/features/export';
import { ImportDialog } from '@/features/import';

// New filter components
import { useTableFilters } from './useTableFilters';
import { FilterBar } from './FilterBar';
import { SortableHeader } from './SortableHeader';
import { PaginationControls } from './PaginationControls';

interface EnhancedTableViewerProps {
  connectionId: string;
  tableName: string;
}

const ROW_HEIGHT = 35;

export function EnhancedTableViewer({ connectionId, tableName }: EnhancedTableViewerProps) {
  const [schema, setSchema] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter/sort/pagination state
  const filters = useTableFilters({ defaultLimit: 100 });

  // Primary key column
  const primaryKeyColumn = useMemo(() => {
    const pk = schema.find(col => col.isPrimaryKey);
    return pk?.name || schema[0]?.name || null;
  }, [schema]);

  // Table editor for changes
  const editor = useTableEditor(primaryKeyColumn);

  // Column widths
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
    count: rows.length + editor.newRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Load schema once
  useEffect(() => {
    getTableSchema(connectionId, tableName)
      .then(setSchema)
      .catch(err => setError(String(err)));
  }, [connectionId, tableName]);

  // Load data when filters/sort/pagination change
  useEffect(() => {
    loadData();
  }, [connectionId, tableName, filters.queryOptions]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTableDataFiltered(connectionId, tableName, filters.queryOptions);
      setColumns(result.columns);
      setRows(result.rows);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Get column type for editing
  const getColumnType = useCallback((colName: string) => {
    return schema.find(c => c.name === colName)?.dataType || 'text';
  }, [schema]);

  // Get row ID (primary key value)
  const getRowId = useCallback((rowIndex: number) => {
    if (!primaryKeyColumn || !rows[rowIndex]) return String(rowIndex);
    const pkIndex = columns.indexOf(primaryKeyColumn);
    return String(rows[rowIndex][pkIndex] ?? rowIndex);
  }, [rows, columns, primaryKeyColumn]);

  // Add row
  const handleAddRow = useCallback(() => {
    const defaultValues: Record<string, unknown> = {};
    schema.forEach(col => {
      defaultValues[col.name] = null;
    });
    editor.addNewRow(defaultValues);
    toast.success('New row added');
  }, [schema, editor]);

  // Commit changes
  const handleCommit = async () => {
    if (!primaryKeyColumn) {
      toast.error('Cannot commit: no primary key found');
      return;
    }

    setIsCommitting(true);
    try {
      const changes = [
        ...editor.pendingChanges.map(c => ({
          rowId: c.rowId,
          column: c.column,
          oldValue: c.oldValue,
          newValue: c.newValue,
          type: c.type as 'update' | 'insert' | 'delete',
        })),
        ...editor.newRows.map(row => ({
          rowId: row.tempId,
          column: '',
          oldValue: null,
          newValue: row.values,
          type: 'insert' as const,
        })),
      ];

      const result = await executeChanges(connectionId, tableName, changes, primaryKeyColumn);

      if (result.success) {
        toast.success(`${result.rowsAffected} row(s) affected`);
        editor.rollbackAll();
        loadData();
      } else {
        toast.error(result.errors?.[0] || 'Failed to commit changes');
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsCommitting(false);
      setShowSqlPreview(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              Commit
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
        
        {/* Export/Import Buttons */}
        <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Import
        </Button>
        
        <div className="h-4 w-px bg-border" />
        
        {filters.isFiltered && (
          <Badge variant="outline" className="text-xs">
            Filtered
          </Badge>
        )}
        
        <div className="text-xs text-muted-foreground">
          {schema.length} columns
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        columns={columns}
        filters={filters.filters}
        filterLogic={filters.filterLogic}
        onAddFilter={filters.addFilter}
        onRemoveFilter={filters.removeFilter}
        onUpdateFilter={filters.updateFilter}
        onClearFilters={filters.clearFilters}
        onSetFilterLogic={filters.setFilterLogic}
      />

      {/* Foreign Keys Panel */}
      <ForeignKeysPanel connectionId={connectionId} tableName={tableName} />

      {/* Table container with virtual scrolling */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        {/* Sortable Header */}
        <div
          className="sticky top-0 z-10 flex bg-background border-b border-border"
          style={{ width: totalWidth }}
        >
          {columns.map((col, colIdx) => {
            const colInfo = schema.find(s => s.name === col);
            return (
              <div
                key={col}
                style={{ width: columnWidths[colIdx], minWidth: columnWidths[colIdx] }}
              >
                <SortableHeader
                  column={col}
                  label={col}
                  currentSort={filters.sort}
                  onSort={filters.toggleSort}
                />
                {colInfo?.isPrimaryKey && (
                  <Badge variant="outline" className="absolute top-1 right-1 text-[10px] px-1 py-0">
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
            const isNewRow = rowIndex >= rows.length;
            const isDeleted = editor.isRowDeleted(rowIndex);

            const rowData = isNewRow
              ? Object.values(editor.newRows[rowIndex - rows.length]?.values || {})
              : rows[rowIndex] || [];

            const rowId = isNewRow
              ? editor.newRows[rowIndex - rows.length]?.tempId || ''
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
                {columns.map((col, colIdx) => {
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
                        onStartEdit={() => editor.startEditing(rowIndex, col)}
                        onSave={(newValue) => {
                          if (isNewRow) {
                            editor.updateNewRow(rowId, col, newValue);
                          } else {
                            editor.updateCell(rowIndex, rowId, col, cellValue, newValue);
                          }
                        }}
                        onCancel={() => editor.stopEditing()}
                        onNavigate={() => {}}
                      />
                    </div>
                  );
                })}

                {/* Row actions */}
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

        {rows.length === 0 && editor.newRows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No data found
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <PaginationControls
        page={filters.page}
        limit={filters.limit}
        totalCount={totalCount}
        onPageChange={filters.goToPage}
        onLimitChange={filters.setLimit}
      />

      {/* SQL Preview Modal */}
      <SqlPreviewModal
        open={showSqlPreview}
        onClose={() => setShowSqlPreview(false)}
        onConfirm={handleCommit}
        sql={editor.generateSqlPreview(tableName)}
        changeCount={editor.changeCount}
        isExecuting={isCommitting}
      />
      
      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        connectionId={connectionId}
        tableName={tableName}
      />
      
      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        connectionId={connectionId}
        tableName={tableName}
        onImportComplete={loadData}
      />
    </div>
  );
}
