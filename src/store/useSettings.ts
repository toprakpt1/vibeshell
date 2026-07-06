// Settings store (v2) — OpenCode server + bridge config

import { create } from 'zustand';
import * as secureStorage from '../utils/secureStorage';

interface SettingsState {
  openCodeUrl: string;
  openCodePassword: string;
  bridgeUrl: string;
  bridgeToken: string;
  model: string;
  agent: string;
  hasSeenOnboarding: boolean;
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  setOpenCodeUrl: (url: string) => Promise<void>;
  setOpenCodePassword: (password: string) => Promise<void>;
  setBridgeUrl: (url: string) => Promise<void>;
  setBridgeToken: (token: string) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  setAgent: (agent: string) => Promise<void>;
  setOnboardingSeen: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  openCodeUrl: 'http://127.0.0.1:4096',
  openCodePassword: '',
  bridgeUrl: 'ws://127.0.0.1:8765',
  bridgeToken: '',
  model: '',
  agent: '',
  hasSeenOnboarding: false,
  isLoaded: false,

  loadSettings: async () => {
    const [openCodeUrl, openCodePassword, bridgeToken, bridgeUrl, model, agent, hasSeenOnboarding] =
      await Promise.all([
        secureStorage.getOpenCodeUrl(),
        secureStorage.getOpenCodePassword(),
        secureStorage.getBridgeToken(),
        secureStorage.getBridgeUrl(),
        secureStorage.getModel(),
        secureStorage.getAgent(),
        secureStorage.getOnboardingSeen(),
      ]);
    set({
      openCodeUrl: openCodeUrl || 'http://127.0.0.1:4096',
      openCodePassword: openCodePassword || '',
      bridgeToken: bridgeToken || '',
      bridgeUrl: bridgeUrl || 'ws://127.0.0.1:8765',
      model: model || '',
      agent: agent || '',
      hasSeenOnboarding,
      isLoaded: true,
    });
  },

  setOpenCodeUrl: async (url: string) => {
    await secureStorage.setOpenCodeUrl(url);
    set({ openCodeUrl: url });
  },

  setOpenCodePassword: async (password: string) => {
    await secureStorage.setOpenCodePassword(password);
    set({ openCodePassword: password });
  },

  setBridgeUrl: async (url: string) => {
    await secureStorage.setBridgeUrl(url);
    set({ bridgeUrl: url });
  },

  setBridgeToken: async (token: string) => {
    await secureStorage.setBridgeToken(token);
    set({ bridgeToken: token });
  },

  setModel: async (model: string) => {
    await secureStorage.setModel(model);
    set({ model });
  },

  setAgent: async (agent: string) => {
    await secureStorage.setAgent(agent);
    set({ agent });
  },

  setOnboardingSeen: async () => {
    await secureStorage.setOnboardingSeen(true);
    set({ hasSeenOnboarding: true });
  },
}));
