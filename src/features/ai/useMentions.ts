// useMentions Hook
// Manages @ mentions for tables and web search in chat input

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface Mention {
  type: 'table' | 'web';
  value: string;
  displayName: string;
}

interface UseMentionsOptions {
  connectionId: string;
}

interface UseMentionsReturn {
  // Current mentions in the message
  mentions: Mention[];
  // Add a mention
  addMention: (mention: Mention) => void;
  // Remove a mention
  removeMention: (value: string) => void;
  // Clear all mentions
  clearMentions: () => void;
  // Available tables for autocomplete
  availableTables: string[];
  // Loading state
  isLoadingTables: boolean;
  // Refresh tables
  refreshTables: () => Promise<void>;
  // Check if web search is enabled
  hasWebMention: boolean;
}

export function useMentions({ connectionId }: UseMentionsOptions): UseMentionsReturn {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Fetch available tables
  const refreshTables = useCallback(async () => {
    if (!connectionId) return;
    
    setIsLoadingTables(true);
    try {
      const tables = await invoke<string[]>('list_tables', { connectionId });
      setAvailableTables(tables || []);
    } catch (e) {
      console.error('[useMentions] Failed to fetch tables:', e);
      setAvailableTables([]);
    } finally {
      setIsLoadingTables(false);
    }
  }, [connectionId]);

  // Load tables on mount and when connection changes
  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  // Add a mention
  const addMention = useCallback((mention: Mention) => {
    setMentions(prev => {
      // Don't add duplicates
      if (prev.some(m => m.type === mention.type && m.value === mention.value)) {
        return prev;
      }
      return [...prev, mention];
    });
  }, []);

  // Remove a mention
  const removeMention = useCallback((value: string) => {
    setMentions(prev => prev.filter(m => m.value !== value));
  }, []);

  // Clear all mentions
  const clearMentions = useCallback(() => {
    setMentions([]);
  }, []);

  // Check if @web is mentioned
  const hasWebMention = mentions.some(m => m.type === 'web');

  return {
    mentions,
    addMention,
    removeMention,
    clearMentions,
    availableTables,
    isLoadingTables,
    refreshTables,
    hasWebMention,
  };
}
