import { useState, useCallback, useMemo } from 'react';
import { 
  ColumnFilter, 
  FilterOperator, 
  SortConfig, 
  SortDirection, 
  FilterLogic,
  VALUE_LESS_OPERATORS 
} from './types';

interface UseTableFiltersOptions {
  defaultLimit?: number;
}

export function useTableFilters({ defaultLimit = 100 }: UseTableFiltersOptions = {}) {
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filterLogic, setFilterLogic] = useState<FilterLogic>('and');
  const [limit, setLimit] = useState(defaultLimit);
  const [page, setPage] = useState(0);

  // Add a new filter
  const addFilter = useCallback((column: string, operator: FilterOperator = 'equals', value?: unknown) => {
    const newFilter: ColumnFilter = {
      column,
      operator,
      value: VALUE_LESS_OPERATORS.includes(operator) ? undefined : value,
    };
    setFilters(prev => [...prev, newFilter]);
    setPage(0); // Reset to first page when adding filter
  }, []);

  // Remove a filter by index
  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
    setPage(0);
  }, []);

  // Update a filter at index
  const updateFilter = useCallback((index: number, updates: Partial<ColumnFilter>) => {
    setFilters(prev => prev.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
    setPage(0);
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters([]);
    setPage(0);
  }, []);

  // Toggle sort on a column
  const toggleSort = useCallback((column: string) => {
    setSort(prev => {
      if (!prev || prev.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return null; // Third click removes sort
    });
    setPage(0);
  }, []);

  // Set sort explicitly
  const setSortColumn = useCallback((column: string, direction: SortDirection) => {
    setSort({ column, direction });
    setPage(0);
  }, []);

  // Clear sort
  const clearSort = useCallback(() => {
    setSort(null);
  }, []);

  // Page navigation
  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(0, prev - 1));
  }, []);

  const goToPage = useCallback((pageNum: number) => {
    setPage(Math.max(0, pageNum));
  }, []);

  // Reset everything
  const resetAll = useCallback(() => {
    setFilters([]);
    setSort(null);
    setFilterLogic('and');
    setPage(0);
  }, []);

  // Calculate offset from page and limit
  const offset = useMemo(() => page * limit, [page, limit]);

  // Build query options object for API call
  const queryOptions = useMemo(() => ({
    filters,
    filterLogic,
    sort,
    limit,
    offset,
  }), [filters, filterLogic, sort, limit, offset]);

  // Check if any filters/sort are active
  const hasActiveFilters = filters.length > 0;
  const hasActiveSort = sort !== null;
  const isFiltered = hasActiveFilters || hasActiveSort;

  return {
    // State
    filters,
    sort,
    filterLogic,
    limit,
    page,
    offset,
    queryOptions,
    
    // Computed
    hasActiveFilters,
    hasActiveSort,
    isFiltered,

    // Filter actions
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    setFilterLogic,

    // Sort actions
    toggleSort,
    setSortColumn,
    clearSort,

    // Pagination actions
    setLimit,
    setPage,
    nextPage,
    prevPage,
    goToPage,

    // Reset
    resetAll,
  };
}
