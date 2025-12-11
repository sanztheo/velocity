// AI Provider Configuration for Velocity
// Supports Grok (priority), OpenAI, and Gemini as fallbacks

import { createXai } from '@ai-sdk/xai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { invoke } from '@tauri-apps/api/core';
import type { AgentMode, AIProvider } from './types';

// Cache for API keys (fetched from Rust backend)
const keyCache: Record<string, string | null> = {};

/**
 * Get API key from Rust backend (secure)
 */
async function getSecureApiKey(provider: AIProvider): Promise<string | null> {
  if (keyCache[provider] !== undefined) {
    return keyCache[provider];
  }
  
  try {
    const key = await invoke<string | null>('get_ai_api_key', { provider });
    keyCache[provider] = key;
    return key;
  } catch (error) {
    console.error(`Failed to get ${provider} API key:`, error);
    keyCache[provider] = null;
    return null;
  }
}

/**
 * Create an AI provider based on available keys and mode
 * Priority: Grok > OpenAI > Gemini
 */
export async function createAIProviderAsync(mode: AgentMode) {
  // Try Grok first (preferred)
  const grokKey = await getSecureApiKey('grok');
  if (grokKey) {
    const xai = createXai({ apiKey: grokKey });
    return mode === 'deep'
      ? xai('grok-3-mini-fast')
      : xai('grok-3-mini-fast');
  }

  // Fallback to OpenAI
  const openaiKey = await getSecureApiKey('openai');
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return mode === 'deep'
      ? openai('gpt-4o')
      : openai('gpt-4o-mini');
  }

  // Fallback to Gemini
  const geminiKey = await getSecureApiKey('gemini');
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return mode === 'deep'
      ? google('gemini-2.0-flash-thinking-exp')
      : google('gemini-2.0-flash');
  }

  throw new Error('No API key configured. Please add a Grok, OpenAI, or Gemini API key in your .env file.');
}

/**
 * Check which API keys are available (from Rust backend)
 */
export async function checkAvailableProviders(): Promise<{
  grok: boolean;
  openai: boolean;
  gemini: boolean;
}> {
  try {
    const status = await invoke<{
      grokAvailable: boolean;
      openaiAvailable: boolean;
      geminiAvailable: boolean;
    }>('get_ai_api_keys_status');
    
    return {
      grok: status.grokAvailable,
      openai: status.openaiAvailable,
      gemini: status.geminiAvailable,
    };
  } catch (error) {
    console.error('Failed to check API keys:', error);
    return { grok: false, openai: false, gemini: false };
  }
}

/**
 * Get best available provider name
 */
export async function getBestProviderName(): Promise<string> {
  const providers = await checkAvailableProviders();
  if (providers.grok) return 'Grok';
  if (providers.openai) return 'OpenAI';
  if (providers.gemini) return 'Gemini';
  return 'None';
}

/**
 * Check if any provider is available
 */
export async function hasAnyProviderAsync(): Promise<boolean> {
  const providers = await checkAvailableProviders();
  return providers.grok || providers.openai || providers.gemini;
}

// Legacy sync functions for backwards compatibility
// These should be migrated to async versions
export function hasAnyProvider(settings: { grokApiKey?: string; openaiApiKey?: string; geminiApiKey?: string }): boolean {
  return !!(settings.grokApiKey || settings.openaiApiKey || settings.geminiApiKey);
}

export function createAIProvider(settings: { grokApiKey?: string; openaiApiKey?: string; geminiApiKey?: string }, mode: AgentMode) {
  if (settings.grokApiKey) {
    const xai = createXai({ apiKey: settings.grokApiKey });
    return mode === 'deep' ? xai('grok-3-mini-fast') : xai('grok-3-mini-fast');
  }
  if (settings.openaiApiKey) {
    const openai = createOpenAI({ apiKey: settings.openaiApiKey });
    return mode === 'deep' ? openai('gpt-4o') : openai('gpt-4o-mini');
  }
  if (settings.geminiApiKey) {
    const google = createGoogleGenerativeAI({ apiKey: settings.geminiApiKey });
    return mode === 'deep' ? google('gemini-2.0-flash-thinking-exp') : google('gemini-2.0-flash');
  }
  throw new Error('No API key configured');
}
