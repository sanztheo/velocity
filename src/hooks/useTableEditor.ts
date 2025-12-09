import { useState, useCallback, useMemo } from 'react';

export type ChangeType = 'update' | 'insert' | 'delete';

export interface PendingChange {
  rowIndex: number;
  rowId: string; // Primary key value
  column: string;
  oldValue: unknown;
  newValue: unknown;
  type: ChangeType;
}

export interface NewRow {
  tempId: string;
  values: Record<string, unknown>;
}

export interface TableEditorState {
  pendingChanges: PendingChange[];
  deletedRows: Set<number>;
  newRows: NewRow[];
  editingCell: { rowIndex: number; column: string } | null;
}

export function useTableEditor(primaryKeyColumn: string | null) {
  const [state, setState] = useState<TableEditorState>({
    pendingChanges: [],
    deletedRows: new Set(),
    newRows: [],
    editingCell: null,
  });

  // Start editing a cell
  const startEditing = useCallback((rowIndex: number, column: string) => {
    setState(prev => ({
      ...prev,
      editingCell: { rowIndex, column },
    }));
  }, []);

  // Stop editing
  const stopEditing = useCallback(() => {
    setState(prev => ({
      ...prev,
      editingCell: null,
    }));
  }, []);

  // Update a cell value
  const updateCell = useCallback((
    rowIndex: number,
    rowId: string,
    column: string,
    oldValue: unknown,
    newValue: unknown
  ) => {
    if (oldValue === newValue) {
      stopEditing();
      return;
    }

    setState(prev => {
      // Check if there's already a change for this cell
      const existingIndex = prev.pendingChanges.findIndex(
        c => c.rowIndex === rowIndex && c.column === column
      );

      const newChange: PendingChange = {
        rowIndex,
        rowId,
        column,
        oldValue: existingIndex >= 0 ? prev.pendingChanges[existingIndex].oldValue : oldValue,
        newValue,
        type: 'update',
      };

      let newChanges: PendingChange[];
      if (existingIndex >= 0) {
        // If reverting to original value, remove the change
        if (newChange.oldValue === newValue) {
          newChanges = prev.pendingChanges.filter((_, i) => i !== existingIndex);
        } else {
          newChanges = [...prev.pendingChanges];
          newChanges[existingIndex] = newChange;
        }
      } else {
        newChanges = [...prev.pendingChanges, newChange];
      }

      return {
        ...prev,
        pendingChanges: newChanges,
        editingCell: null,
      };
    });
  }, [stopEditing]);

  // Mark a row for deletion
  const deleteRow = useCallback((rowIndex: number, rowId: string) => {
    setState(prev => {
      const newDeleted = new Set(prev.deletedRows);
      newDeleted.add(rowIndex);

      // Add delete change
      const deleteChange: PendingChange = {
        rowIndex,
        rowId,
        column: '',
        oldValue: null,
        newValue: null,
        type: 'delete',
      };

      return {
        ...prev,
        deletedRows: newDeleted,
        pendingChanges: [...prev.pendingChanges.filter(c => c.rowIndex !== rowIndex), deleteChange],
      };
    });
  }, []);

  // Undelete a row
  const undeleteRow = useCallback((rowIndex: number) => {
    setState(prev => {
      const newDeleted = new Set(prev.deletedRows);
      newDeleted.delete(rowIndex);

      return {
        ...prev,
        deletedRows: newDeleted,
        pendingChanges: prev.pendingChanges.filter(c => !(c.rowIndex === rowIndex && c.type === 'delete')),
      };
    });
  }, []);

  // Add a new row
  const addNewRow = useCallback((defaultValues: Record<string, unknown> = {}) => {
    const tempId = `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setState(prev => ({
      ...prev,
      newRows: [...prev.newRows, { tempId, values: defaultValues }],
    }));
    return tempId;
  }, []);

  // Update a new row's value
  const updateNewRow = useCallback((tempId: string, column: string, value: unknown) => {
    setState(prev => ({
      ...prev,
      newRows: prev.newRows.map(row =>
        row.tempId === tempId
          ? { ...row, values: { ...row.values, [column]: value } }
          : row
      ),
    }));
  }, []);

  // Remove a new row (before commit)
  const removeNewRow = useCallback((tempId: string) => {
    setState(prev => ({
      ...prev,
      newRows: prev.newRows.filter(row => row.tempId !== tempId),
    }));
  }, []);

  // Rollback all changes
  const rollbackAll = useCallback(() => {
    setState({
      pendingChanges: [],
      deletedRows: new Set(),
      newRows: [],
      editingCell: null,
    });
  }, []);

  // Undo last change
  const undoLast = useCallback(() => {
    setState(prev => {
      if (prev.pendingChanges.length === 0) return prev;

      const lastChange = prev.pendingChanges[prev.pendingChanges.length - 1];
      const newChanges = prev.pendingChanges.slice(0, -1);

      // If it was a delete, restore the row
      if (lastChange.type === 'delete') {
        const newDeleted = new Set(prev.deletedRows);
        newDeleted.delete(lastChange.rowIndex);
        return {
          ...prev,
          pendingChanges: newChanges,
          deletedRows: newDeleted,
        };
      }

      return {
        ...prev,
        pendingChanges: newChanges,
      };
    });
  }, []);

  // Check if a cell has pending changes
  const getCellChange = useCallback((rowIndex: number, column: string): PendingChange | undefined => {
    return state.pendingChanges.find(c => c.rowIndex === rowIndex && c.column === column);
  }, [state.pendingChanges]);

  // Check if row is marked for deletion
  const isRowDeleted = useCallback((rowIndex: number): boolean => {
    return state.deletedRows.has(rowIndex);
  }, [state.deletedRows]);

  // Generate SQL preview
  const generateSqlPreview = useCallback((tableName: string): string => {
    const statements: string[] = [];

    // Updates
    const updates = state.pendingChanges.filter(c => c.type === 'update');
    const updatesByRow = new Map<string, PendingChange[]>();
    updates.forEach(c => {
      const existing = updatesByRow.get(c.rowId) || [];
      existing.push(c);
      updatesByRow.set(c.rowId, existing);
    });

    updatesByRow.forEach((changes, rowId) => {
      const setClauses = changes.map(c => {
        const value = typeof c.newValue === 'string' ? `'${c.newValue}'` : c.newValue;
        return `"${c.column}" = ${value === null ? 'NULL' : value}`;
      }).join(', ');
      statements.push(`UPDATE "${tableName}" SET ${setClauses} WHERE "${primaryKeyColumn}" = ${typeof rowId === 'string' ? `'${rowId}'` : rowId};`);
    });

    // Inserts
    state.newRows.forEach(row => {
      const columns = Object.keys(row.values).map(c => `"${c}"`).join(', ');
      const values = Object.values(row.values).map(v => {
        if (v === null) return 'NULL';
        if (typeof v === 'string') return `'${v}'`;
        return String(v);
      }).join(', ');
      statements.push(`INSERT INTO "${tableName}" (${columns}) VALUES (${values});`);
    });

    // Deletes
    const deletes = state.pendingChanges.filter(c => c.type === 'delete');
    deletes.forEach(c => {
      statements.push(`DELETE FROM "${tableName}" WHERE "${primaryKeyColumn}" = ${typeof c.rowId === 'string' ? `'${c.rowId}'` : c.rowId};`);
    });

    if (statements.length === 0) return '-- No changes';

    return `BEGIN TRANSACTION;\n\n${statements.join('\n')}\n\nCOMMIT;`;
  }, [state, primaryKeyColumn]);

  // Has unsaved changes
  const hasChanges = useMemo(() => {
    return state.pendingChanges.length > 0 || state.newRows.length > 0;
  }, [state.pendingChanges, state.newRows]);

  // Change count
  const changeCount = useMemo(() => {
    return state.pendingChanges.length + state.newRows.length;
  }, [state.pendingChanges, state.newRows]);

  return {
    // State
    editingCell: state.editingCell,
    pendingChanges: state.pendingChanges,
    newRows: state.newRows,
    hasChanges,
    changeCount,

    // Actions
    startEditing,
    stopEditing,
    updateCell,
    deleteRow,
    undeleteRow,
    addNewRow,
    updateNewRow,
    removeNewRow,
    rollbackAll,
    undoLast,

    // Queries
    getCellChange,
    isRowDeleted,
    generateSqlPreview,
  };
}
