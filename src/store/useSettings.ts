// Settings store — API key, model, provider, system prompt
// Uses Zustand with secure storage for sensitive data

import { create } from 'zustand';
import * as secureStorage from '../utils/secureStorage';

export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'openrouter' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'openrouter' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'openrouter' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'openrouter' },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

interface SettingsState {
  apiKey: string;
  model: ModelId;
  bridgeUrl: string;
  bridgeToken: string;
  systemPrompt: string;
  hasSeenOnboarding: boolean;
  isLoaded: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setModel: (model: ModelId) => Promise<void>;
  setBridgeUrl: (url: string) => Promise<void>;
  setBridgeToken: (token: string) => Promise<void>;
  setSystemPrompt: (prompt: string) => void;
  setOnboardingSeen: () => Promise<void>;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful coding assistant. You have access to tools for reading and writing files, running shell commands, and working with git. Use these tools to help the user with their coding tasks.

When writing code:
- Write clean, well-structured code
- Add comments where helpful
- Follow the project's existing coding conventions
- Test your changes when possible

When using tools:
- Read files before modifying them to understand context
- Use list_dir to explore project structure
- Run tests after making changes
- Make git commits with descriptive messages`;

export const useSettings = create<SettingsState>((set) => ({
  apiKey: '',
  model: 'anthropic/claude-sonnet-4',
  bridgeUrl: 'ws://127.0.0.1:8765',
  bridgeToken: '',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  hasSeenOnboarding: false,
  isLoaded: false,

  loadSettings: async () => {
    const [apiKey, model, bridgeToken, bridgeUrl, hasSeenOnboarding] = await Promise.all([
      secureStorage.getApiKey(),
      secureStorage.getModel(),
      secureStorage.getBridgeToken(),
      secureStorage.getBridgeUrl(),
      secureStorage.getOnboardingSeen(),
    ]);
    set({
      apiKey: apiKey || '',
      model: (model as ModelId) || 'anthropic/claude-sonnet-4',
      bridgeToken: bridgeToken || '',
      bridgeUrl: bridgeUrl || 'ws://127.0.0.1:8765',
      hasSeenOnboarding,
      isLoaded: true,
    });
  },

  setApiKey: async (key: string) => {
    await secureStorage.setApiKey(key);
    set({ apiKey: key });
  },

  setModel: async (model: ModelId) => {
    await secureStorage.setModel(model);
    set({ model });
  },

  setBridgeUrl: async (url: string) => {
    await secureStorage.setBridgeUrl(url);
    set({ bridgeUrl: url });
  },

  setBridgeToken: async (token: string) => {
    await secureStorage.setBridgeToken(token);
    set({ bridgeToken: token });
  },

  setSystemPrompt: (prompt: string) => set({ systemPrompt: prompt }),

  setOnboardingSeen: async () => {
    await secureStorage.setOnboardingSeen(true);
    set({ hasSeenOnboarding: true });
  },
}));
