// Bridge protocol type definitions for VibeSHell
// Defines the communication protocol between RN app and Termux bridge server

export type BridgeMethod =
  | 'exec'
  | 'read_file'
  | 'write_file'
  | 'list_dir'
  | 'delete_file'
  | 'git_diff'
  | 'git_commit';

export interface BridgeRequest {
  id: string;
  method: BridgeMethod;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface BridgeStreamMessage {
  id: string;
  stream: 'stdout' | 'stderr';
  data: string;
}

export interface ExecParams {
  command: string;
  cwd?: string;
}

export interface ExecResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface ReadFileParams {
  path: string;
}

export interface WriteFileParams {
  path: string;
  content: string;
}

export interface ListDirParams {
  path: string;
}

export interface ListDirEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface DeleteFileParams {
  path: string;
}

export interface GitDiffParams {
  cwd: string;
}

export interface GitCommitParams {
  cwd: string;
  message: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
