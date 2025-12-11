// AI Provider Configuration for Velocity
// Supports Grok (priority), OpenAI, and Gemini as fallbacks

import { createXai } from '@ai-sdk/xai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AISettings, AgentMode } from './types';

/**
 * Create an AI provider based on settings and mode
 * Priority: Grok > OpenAI > Gemini
 */
export function createAIProvider(settings: AISettings, mode: AgentMode) {
  // Try Grok first (preferred)
  if (settings.grokApiKey) {
    const xai = createXai({ apiKey: settings.grokApiKey });
    // Use reasoning model for deep mode, non-reasoning for fast mode
    return mode === 'deep'
      ? xai('grok-4-1-fast-reasoning')
      : xai('grok-4-1-fast-non-reasoning');
  }

  // Fallback to OpenAI
  if (settings.openaiApiKey) {
    const openai = createOpenAI({ apiKey: settings.openaiApiKey });
    return mode === 'deep'
      ? openai('gpt-4o')
      : openai('gpt-4o-mini');
  }

  // Fallback to Gemini
  if (settings.geminiApiKey) {
    const google = createGoogleGenerativeAI({ apiKey: settings.geminiApiKey });
    return mode === 'deep'
      ? google('gemini-2.0-flash-thinking-exp')
      : google('gemini-2.0-flash');
  }

  throw new Error('No API key configured. Please add a Grok, OpenAI, or Gemini API key in settings.');
}

/**
 * Get provider name for display
 */
export function getProviderFromSettings(settings: AISettings): string {
  if (settings.grokApiKey) return 'Grok';
  if (settings.openaiApiKey) return 'OpenAI';
  if (settings.geminiApiKey) return 'Gemini';
  return 'None';
}

/**
 * Check if any provider is configured
 */
export function hasAnyProvider(settings: AISettings): boolean {
  return !!(settings.grokApiKey || settings.openaiApiKey || settings.geminiApiKey);
}
