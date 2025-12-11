// AI Settings Store using Zustand
// Manages API keys and AI preferences

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AISettings, AIProvider } from './types';

interface AISettingsState extends AISettings {
  // Actions
  setGrokApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;
  setPreferredProvider: (provider: AIProvider) => void;
  setAutoAcceptSql: (accept: boolean) => void;
  clearAllKeys: () => void;
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
    (set) => ({
      ...defaultSettings,

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
    }),
    {
      name: 'velocity-ai-settings',
      storage: createJSONStorage(() => localStorage),
      // Only persist non-sensitive data - keys should use keychain in production
      partialize: (state) => ({
        preferredProvider: state.preferredProvider,
        autoAcceptSql: state.autoAcceptSql,
        // For dev convenience, persist keys in localStorage
        // In production, use Tauri keychain plugin instead
        grokApiKey: state.grokApiKey,
        openaiApiKey: state.openaiApiKey,
        geminiApiKey: state.geminiApiKey,
      }),
    }
  )
);
