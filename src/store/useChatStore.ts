// Chat store (v2) — manages messages via OpenCode API

import { create } from 'zustand';
import { useOpenCodeStore } from './useOpenCodeStore';
import { useWorkspaces } from './useWorkspaces';
import type { UIMessage, UIToolCall, MessagePart } from '../opencode/types';
import type { OpenCodeEvent } from '../opencode/events';
import {
  sendMessage as apiSendMessage,
  sendMessageAsync,
  getMessages,
} from '../opencode/sessions';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface ChatState {
  messages: UIMessage[];
  isRunning: boolean;
  currentSessionId: string | null;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  stopAgent: () => void;
  clearChat: () => void;
  loadHistory: (sessionId: string) => Promise<void>;
  setSession: (sessionId: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isRunning: false,
  currentSessionId: null,

  sendMessage: async (text: string) => {
    if (get().isRunning) return;

    const { client, currentSessionId, selectedAgent } = useOpenCodeStore.getState();
    if (!client) {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: generateId(),
            role: 'system',
            content: 'OpenCode server bagli degil. Ayarlardan sunucu adresini kontrol edin.',
            timestamp: Date.now(),
          },
        ],
      }));
      return;
    }

    const workspace = useWorkspaces.getState().getActiveWorkspace();

    // Create session if needed
    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const session = await useOpenCodeStore.getState().createSession(
          workspace?.name || 'Chat',
        );
        sessionId = session.id;
        set({ currentSessionId: sessionId });
        useOpenCodeStore.getState().setCurrentSession(sessionId);
      } catch (err) {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: generateId(),
              role: 'system',
              content: `Session olusturulamadi: ${err instanceof Error ? err.message : String(err)}`,
              timestamp: Date.now(),
            },
          ],
        }));
        return;
      }
    }

    // Add user message
    const userMsg: UIMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    // Add placeholder assistant message
    const assistantMsgId = generateId();
    const assistantMsg: UIMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      parts: [],
      toolCalls: [],
      timestamp: Date.now(),
      isStreaming: true,
    };

    set({
      messages: [...get().messages, userMsg, assistantMsg],
      isRunning: true,
    });

    // Listen for real-time events
    const unsubscribe = useOpenCodeStore.getState().onEvent((event: OpenCodeEvent) => {
      if (event.sessionID !== sessionId) return;

      if (event.type === 'message.part.updated' || event.type === 'message.part.created') {
        const part = event.properties as any;
        if (part?.type === 'text' && part?.text) {
          // Text streaming update
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: (m.content || '') + part.text }
                : m,
            ),
          }));
        } else if (part?.type === 'tool_call') {
          // Tool call started
          const toolCall: UIToolCall = {
            id: part.toolCallID || generateId(),
            name: part.name || 'unknown',
            input: part.parameters || {},
            isRunning: true,
          };
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMsgId
                ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                : m,
            ),
          }));
        } else if (part?.type === 'tool_result') {
          // Tool call completed
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls || []).map((tc) =>
                      tc.id === part.toolCallID
                        ? { ...tc, result: part.result, isError: part.isError, isRunning: false }
                        : tc,
                    ),
                  }
                : m,
            ),
          }));
        } else if (part?.type === 'file_rewrite' || part?.type === 'file_write') {
          // File change — add as tool call display
          const toolCall: UIToolCall = {
            id: generateId(),
            name: part.type === 'file_write' ? 'write_file' : 'apply_patch',
            input: { path: part.path, content: part.content || part.diff },
            result: 'OK',
            isRunning: false,
          };
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMsgId
                ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                : m,
            ),
          }));
        } else if (part?.type === 'shell_exec') {
          // Shell execution
          const toolCall: UIToolCall = {
            id: generateId(),
            name: 'run_command',
            input: { command: part.command },
            result: part.output || '',
            isError: part.exitCode !== 0,
            isRunning: false,
          };
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMsgId
                ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                : m,
            ),
          }));
        }
      } else if (event.type === 'step.finished') {
        // Step done — could update usage info
      }
    });

    try {
      // Send message to OpenCode (synchronous — waits for full response)
      const response = await apiSendMessage(client, sessionId!, text, {
        ...(selectedAgent && { agent: selectedAgent }),
      });

      // Build final message from response parts
      let finalContent = '';
      const finalToolCalls: UIToolCall[] = [];

      if (response.parts) {
        for (const part of response.parts) {
          if ((part as any).type === 'text') {
            finalContent += (part as any).text || '';
          } else if ((part as any).type === 'tool_call') {
            finalToolCalls.push({
              id: (part as any).toolCallID || generateId(),
              name: (part as any).name || 'unknown',
              input: (part as any).parameters || {},
              result: undefined,
              isRunning: false,
            });
          }
        }
      }

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: finalContent || m.content,
                toolCalls: finalToolCalls.length > 0 ? finalToolCalls : m.toolCalls,
                isStreaming: false,
              }
            : m,
        ),
        isRunning: false,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set((state) => ({
        messages: [
          ...state.messages.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
          ),
          {
            id: generateId(),
            role: 'system',
            content: `Hata: ${msg}`,
            timestamp: Date.now(),
          },
        ],
        isRunning: false,
      }));
    } finally {
      unsubscribe();
    }
  },

  stopAgent: async () => {
    const { currentSessionId } = get();
    if (currentSessionId) {
      await useOpenCodeStore.getState().abortSession(currentSessionId);
    }
    set({ isRunning: false });
  },

  clearChat: () => {
    set({
      messages: [],
      isRunning: false,
      currentSessionId: null,
    });
  },

  loadHistory: async (sessionId: string) => {
    const { client } = useOpenCodeStore.getState();
    if (!client) return;

    try {
      const history = await getMessages(client, sessionId);
      const uiMessages: UIMessage[] = [];

      for (const msg of history) {
        const parts = msg.parts || [];
        let content = '';
        const toolCalls: UIToolCall[] = [];

        for (const part of parts) {
          if ((part as any).type === 'text') {
            content += (part as any).text || '';
          } else if ((part as any).type === 'tool_call') {
            toolCalls.push({
              id: (part as any).toolCallID || generateId(),
              name: (part as any).name || 'unknown',
              input: (part as any).parameters || {},
              isRunning: false,
            });
          }
        }

        uiMessages.push({
          id: msg.info.id || generateId(),
          role: (msg.info as any).role || 'assistant',
          content,
          toolCalls,
          timestamp: Date.now(),
        });
      }

      set({ messages: uiMessages, currentSessionId: sessionId });
    } catch (err) {
      console.error('[Chat] Failed to load history:', err);
    }
  },

  setSession: (sessionId: string | null) => {
    set({ currentSessionId: sessionId });
    if (sessionId) {
      get().loadHistory(sessionId);
    }
  },
}));
