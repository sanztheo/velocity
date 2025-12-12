import { useCallback, useRef, useMemo } from 'react';
import { generateObject } from 'ai';
import { z } from 'zod';
import { useAISettingsStore, getBestProvider } from '../ai/ai-settings.store';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

interface UseAiCompletionProps {
  tables: string[];
  columns: Record<string, string[]>;
  dbType: string;
}

export function useAiCompletion({ tables, columns, dbType }: UseAiCompletionProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRequestRef = useRef<string>('');
  const settings = useAISettingsStore();

  // Keep useMemo to avoid linter warning if we keep the hook structure
  useMemo(() => {}, []);

  const getAiSuggestions = useCallback(async (partialSql: string): Promise<string[]> => {
    // Avoid duplicate requests
    if (partialSql === lastRequestRef.current) return [];
    lastRequestRef.current = partialSql;

    // Only trigger for meaningful queries (at least 5 chars)
    if (partialSql.trim().length < 5) return [];

    try {
      const providerName = (settings.preferredProvider || getBestProvider(settings) || 'grok') as 'grok' | 'openai' | 'gemini';
      const apiKey = await settings.getApiKey(providerName);
      
      if (!apiKey) return [];

      let model;
      if (providerName === 'grok') {
        model = createXai({ apiKey })('grok-beta');
      } else if (providerName === 'openai') {
        model = createOpenAI({ apiKey })('gpt-4o-mini');
      } else if (providerName === 'gemini') {
        model = createGoogleGenerativeAI({ apiKey })('gemini-1.5-flash');
      } else {
        return [];
      }

      const columnContext = Object.values(columns).flat();
      const systemPrompt = `You are a SQL assistant for ${dbType}. Given partial SQL and context, suggest 3-5 SQL completions. \
        Available tables: ${tables.join(", ")}. Available columns: ${columnContext.join(", ")}.`;

      const result = await generateObject({
        model,
        system: systemPrompt,
        prompt: `Complete this SQL: ${partialSql}`,
        schema: z.object({
            suggestions: z.array(z.string()),
        }),
      });

      return result.object.suggestions;
    } catch (e) {
      console.error('AI Completion Error:', e);
      return [];
    }
  }, [tables, columns, dbType, settings]);

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
