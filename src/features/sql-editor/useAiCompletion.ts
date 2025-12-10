import { useCallback, useRef } from 'react';
import { aiSqlComplete, AiCompletionRequest } from '@/lib/tauri';

interface UseAiCompletionProps {
  tables: string[];
  columns: Record<string, string[]>;
  dbType: string;
}

export function useAiCompletion({ tables, columns, dbType }: UseAiCompletionProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestRef = useRef<string>('');

  const getAiSuggestions = useCallback(async (partialSql: string): Promise<string[]> => {
    // Avoid duplicate requests
    if (partialSql === lastRequestRef.current) return [];
    lastRequestRef.current = partialSql;

    // Only trigger for meaningful queries (at least 5 chars)
    if (partialSql.trim().length < 5) return [];

    try {
      const columnContext = Object.values(columns).flat();
      
      const request: AiCompletionRequest = {
        partialSql,
        tableContext: tables,
        columnContext,
        dbType,
      };

      const response = await aiSqlComplete(request);
      return response.suggestions;
    } catch {
      // API key not set or error - fail silently
      return [];
    }
  }, [tables, columns, dbType]);

  const getAiSuggestionsDebounced = useCallback((partialSql: string): Promise<string[]> => {
    return new Promise((resolve) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(async () => {
        const suggestions = await getAiSuggestions(partialSql);
        resolve(suggestions);
      }, 500); // 500ms debounce
    });
  }, [getAiSuggestions]);

  return {
    getAiSuggestions,
    getAiSuggestionsDebounced,
  };
}
