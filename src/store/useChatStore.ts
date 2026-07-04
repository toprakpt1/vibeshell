// Chat store — manages conversation state, messages, and agent execution
// Central store for the chat UI

import { create } from 'zustand';
import { ChatMessage, ToolCallDisplay, Message, ContentBlock } from '../agent/types';
import { runAgentLoop } from '../agent/AgentLoop';
import { useSettings } from './useSettings';
import { useWorkspaces } from './useWorkspaces';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface ChatState {
  messages: ChatMessage[];
  isRunning: boolean;
  abortController: AbortController | null;
  totalInputTokens: number;
  totalOutputTokens: number;

  // Internal conversation state (for AI)
  conversationMessages: Message[];

  // Actions
  sendMessage: (text: string) => Promise<void>;
  stopAgent: () => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isRunning: false,
  abortController: null,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  conversationMessages: [],

  sendMessage: async (text: string) => {
    if (get().isRunning) return;

    const settings = useSettings.getState();
    const workspace = useWorkspaces.getState().getActiveWorkspace();

    if (!settings.apiKey) {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: generateId(),
            role: 'system',
            content: '⚠️ API key ayarlanmamış. Ayarlar\'dan OpenRouter API key\'inizi girin.',
            timestamp: Date.now(),
          },
        ],
      }));
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    // Add user message to internal conversation
    const userContent: ContentBlock[] = [{ type: 'text', text }];
    const updatedConversation: Message[] = [
      ...get().conversationMessages,
      { role: 'user', content: userContent },
    ];

    const abortController = new AbortController();

    // Add a placeholder assistant message
    const assistantMsgId = generateId();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: Date.now(),
      isStreaming: true,
    };

    set({
      messages: [...get().messages, userMsg, assistantMsg],
      isRunning: true,
      abortController,
      conversationMessages: updatedConversation,
    });

    const workspacePath = workspace?.path || '/data/data/com.termux/files/home';

    try {
      const resultMessages = await runAgentLoop(
        settings.apiKey,
        settings.model,
        settings.systemPrompt,
        updatedConversation,
        workspacePath,
        {
          onAssistantText: (text: string) => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + text }
                  : m,
              ),
            }));
          },
          onToolCall: (id: string, name: string, input: Record<string, unknown>) => {
            const toolCall: ToolCallDisplay = {
              id,
              name,
              input,
              isRunning: true,
            };
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                  : m,
              ),
            }));
          },
          onToolResult: (id: string, result: string, isError: boolean) => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      toolCalls: (m.toolCalls || []).map((tc) =>
                        tc.id === id
                          ? { ...tc, result, isError, isRunning: false }
                          : tc,
                      ),
                    }
                  : m,
              ),
            }));
          },
          onComplete: () => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false }
                  : m,
              ),
              isRunning: false,
              abortController: null,
            }));
          },
          onError: (error: string) => {
            set((state) => ({
              messages: [
                ...state.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, isStreaming: false }
                    : m,
                ),
                {
                  id: generateId(),
                  role: 'system' as const,
                  content: `❌ Hata: ${error}`,
                  timestamp: Date.now(),
                },
              ],
              isRunning: false,
              abortController: null,
            }));
          },
          onUsage: (input: number, output: number) => {
            set((state) => ({
              totalInputTokens: state.totalInputTokens + input,
              totalOutputTokens: state.totalOutputTokens + output,
            }));
          },
        },
        abortController.signal,
      );

      set({ conversationMessages: resultMessages });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: generateId(),
            role: 'system' as const,
            content: `❌ Hata: ${message}`,
            timestamp: Date.now(),
          },
        ],
        isRunning: false,
        abortController: null,
      }));
    }
  },

  stopAgent: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ isRunning: false, abortController: null });
  },

  clearChat: () => {
    set({
      messages: [],
      conversationMessages: [],
      isRunning: false,
      abortController: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
  },
}));
