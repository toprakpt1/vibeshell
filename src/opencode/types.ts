// Re-export OpenCode SDK types for use throughout the app

export type { Session, Message, Agent, FileDiff } from '@opencode-ai/sdk/client';

// Part type from the SDK
export type { Part } from '@opencode-ai/sdk/client';

// Provider and Config types
export type { Provider, Config } from '@opencode-ai/sdk/client';

// Message part types used in the UI
export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolCallPart {
  type: 'tool_call';
  toolCallID: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool_result';
  toolCallID: string;
  result: string;
  isError?: boolean;
}

export interface StepStartPart {
  type: 'step_start';
}

export interface StepFinishPart {
  type: 'step_finish';
  finishReason?: string;
  usage?: { input: number; output: number };
}

export interface FileWritePart {
  type: 'file_write';
  path: string;
  content: string;
}

export interface FileDeletePart {
  type: 'file_delete';
  path: string;
}

export interface FileRewritePart {
  type: 'file_rewrite';
  path: string;
  diff: string;
}

export interface ShellExecPart {
  type: 'shell_exec';
  command: string;
  output?: string;
  exitCode?: number;
}

export interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

export type MessagePart =
  | TextPart
  | ToolCallPart
  | ToolResultPart
  | StepStartPart
  | StepFinishPart
  | FileWritePart
  | FileDeletePart
  | FileRewritePart
  | ShellExecPart
  | ReasoningPart;

// UI message format
export interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: MessagePart[];
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: UIToolCall[];
}

export interface UIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
}

// Agent mode toggle
export type AgentMode = 'plan' | 'build';
