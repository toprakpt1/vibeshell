// OpenCode connection + session state store

import { create } from 'zustand';
import {
  getOpenCodeClient,
  resetOpenCodeClient,
  checkHealth,
  type Client,
} from '../opencode/client';
import {
  getEventSource,
  resetEventSource,
  type OpenCodeEvent,
} from '../opencode/events';
import {
  createSession as apiCreateSession,
  listSessions,
  getAgents,
  abortSession as apiAbortSession,
} from '../opencode/sessions';
import type { Session, Agent } from '../opencode/types';

interface OpenCodeState {
  connected: boolean;
  serverVersion: string | null;
  client: Client | null;
  sessions: Session[];
  currentSessionId: string | null;
  agents: Agent[];
  selectedAgent: string | null;
  eventHandlers: ((event: OpenCodeEvent) => void)[];

  // Actions
  connect: (baseUrl: string, password?: string) => Promise<void>;
  disconnect: () => void;
  loadSessions: () => Promise<void>;
  createSession: (title: string) => Promise<Session>;
  setCurrentSession: (id: string | null) => void;
  setSelectedAgent: (agentId: string | null) => void;
  loadAgents: () => Promise<void>;
  abortSession: (sessionId: string) => Promise<void>;
  onEvent: (handler: (event: OpenCodeEvent) => void) => () => void;
}

export const useOpenCodeStore = create<OpenCodeState>((set, get) => ({
  connected: false,
  serverVersion: null,
  client: null,
  sessions: [],
  currentSessionId: null,
  agents: [],
  selectedAgent: null,
  eventHandlers: [],

  connect: async (baseUrl: string, password?: string) => {
    // Check health first
    const healthy = await checkHealth(baseUrl);
    if (!healthy) {
      set({ connected: false, serverVersion: null });
      return;
    }

    // Create client
    resetOpenCodeClient();
    const client = getOpenCodeClient(baseUrl, password);
    set({ client, connected: true });

    // Get server version
    try {
      const res = await fetch(`${baseUrl}/global/health`);
      const data = await res.json();
      set({ serverVersion: data.version });
    } catch {}

    // Subscribe to events
    const headers: Record<string, string> = {};
    if (password) {
      const encoded = btoa(`opencode:${password}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }
    const eventSource = getEventSource(client, baseUrl, headers);
    eventSource.on('*', (event) => {
      get().eventHandlers.forEach((h) => h(event));
    });

    // Load initial data
    await get().loadSessions();
    await get().loadAgents();
  },

  disconnect: () => {
    resetEventSource();
    resetOpenCodeClient();
    set({
      connected: false,
      serverVersion: null,
      client: null,
      sessions: [],
      currentSessionId: null,
      agents: [],
      eventHandlers: [],
    });
  },

  loadSessions: async () => {
    const { client } = get();
    if (!client) return;
    try {
      const sessions = await listSessions(client);
      set({ sessions });
    } catch (err) {
      console.error('[OpenCode] Failed to load sessions:', err);
    }
  },

  createSession: async (title: string) => {
    const { client } = get();
    if (!client) throw new Error('Not connected to OpenCode');
    const session = await apiCreateSession(client, title);
    set((state) => ({ sessions: [session, ...state.sessions] }));
    return session;
  },

  setCurrentSession: (id: string | null) => {
    set({ currentSessionId: id });
  },

  setSelectedAgent: (agentId: string | null) => {
    set({ selectedAgent: agentId });
  },

  loadAgents: async () => {
    const { client } = get();
    if (!client) return;
    try {
      const agents = await getAgents(client);
      set({ agents });
    } catch (err) {
      console.error('[OpenCode] Failed to load agents:', err);
    }
  },

  abortSession: async (sessionId: string) => {
    const { client } = get();
    if (!client) return;
    try {
      await apiAbortSession(client, sessionId);
    } catch (err) {
      console.error('[OpenCode] Failed to abort session:', err);
    }
  },

  onEvent: (handler: (event: OpenCodeEvent) => void) => {
    set((state) => ({ eventHandlers: [...state.eventHandlers, handler] }));
    return () => {
      set((state) => ({
        eventHandlers: state.eventHandlers.filter((h) => h !== handler),
      }));
    };
  },
}));
