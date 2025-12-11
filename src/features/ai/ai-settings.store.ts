// AI Settings Store using Zustand
// Manages API keys and AI preferences
// Keys are fetched from Rust backend (env vars) for security

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { AISettings, AIProvider } from './types';

interface AiApiKeysStatus {
  grokAvailable: boolean;
  openaiAvailable: boolean;
  geminiAvailable: boolean;
}

interface AISettingsState extends AISettings {
  // Status of API keys from env vars
  envKeysLoaded: boolean;
  envKeysStatus: AiApiKeysStatus | null;
  
  // Actions
  setGrokApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;
  setPreferredProvider: (provider: AIProvider) => void;
  setAutoAcceptSql: (accept: boolean) => void;
  clearAllKeys: () => void;
  
  // Load keys from Rust backend
  loadEnvKeys: () => Promise<void>;
  getApiKey: (provider: AIProvider) => Promise<string | null>;
}

const defaultSettings: AISettings = {
  grokApiKey: undefined,
  openaiApiKey: undefined,
  geminiApiKey: undefined,
  preferredProvider: 'grok',
  autoAcceptSql: false,
};

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      envKeysLoaded: false,
      envKeysStatus: null,

      setGrokApiKey: (key) => set({ grokApiKey: key || undefined }),
      setOpenaiApiKey: (key) => set({ openaiApiKey: key || undefined }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key || undefined }),
      setPreferredProvider: (provider) => set({ preferredProvider: provider }),
      setAutoAcceptSql: (accept) => set({ autoAcceptSql: accept }),
      clearAllKeys: () => set({
        grokApiKey: undefined,
        openaiApiKey: undefined,
        geminiApiKey: undefined,
      }),
      
      // Load availability status from Rust backend
      loadEnvKeys: async () => {
        try {
          const status = await invoke<AiApiKeysStatus>('get_ai_api_keys_status');
          set({ envKeysStatus: status, envKeysLoaded: true });
        } catch (error) {
          console.error('Failed to load env keys status:', error);
          set({ envKeysLoaded: true });
        }
      },
      
      // Get actual API key from Rust backend (secure)
      getApiKey: async (provider: AIProvider): Promise<string | null> => {
        const state = get();
        
        // First check if we have a key in store (user-provided override)
        if (provider === 'grok' && state.grokApiKey) return state.grokApiKey;
        if (provider === 'openai' && state.openaiApiKey) return state.openaiApiKey;
        if (provider === 'gemini' && state.geminiApiKey) return state.geminiApiKey;
        
        // Otherwise fetch from Rust backend (env vars)
        try {
          const key = await invoke<string | null>('get_ai_api_key', { provider });
          return key;
        } catch (error) {
          console.error(`Failed to get ${provider} API key:`, error);
          return null;
        }
      },
    }),
    {
      name: 'velocity-ai-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferredProvider: state.preferredProvider,
        autoAcceptSql: state.autoAcceptSql,
        // Only persist user-provided override keys
        grokApiKey: state.grokApiKey,
        openaiApiKey: state.openaiApiKey,
        geminiApiKey: state.geminiApiKey,
      }),
    }
  )
);

// Helper to check if any provider is available
export function hasAnyProviderAvailable(state: AISettingsState): boolean {
  // Check user-provided keys first
  if (state.grokApiKey || state.openaiApiKey || state.geminiApiKey) {
    return true;
  }
  // Check env keys
  if (state.envKeysStatus) {
    return state.envKeysStatus.grokAvailable || 
           state.envKeysStatus.openaiAvailable || 
           state.envKeysStatus.geminiAvailable;
  }
  return false;
}

// Helper to get the best available provider
export function getBestProvider(state: AISettingsState): AIProvider | null {
  // Priority: Grok > OpenAI > Gemini
  if (state.grokApiKey || state.envKeysStatus?.grokAvailable) return 'grok';
  if (state.openaiApiKey || state.envKeysStatus?.openaiAvailable) return 'openai';
  if (state.geminiApiKey || state.envKeysStatus?.geminiAvailable) return 'gemini';
  return null;
}
