// Bridge protocol type definitions (v2 — exec only)

export type BridgeMethod = 'exec';

export interface BridgeRequest {
  id: string;
  method: BridgeMethod;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: string;
}

export interface BridgeStreamMessage {
  id: string;
  stream: 'stdout' | 'stderr';
  data: string;
}

export interface ExecParams {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ExecResult {
  exitCode: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
