// Bridge command helpers — high-level API for interacting with Termux bridge
// Each function maps to a bridge server command

import { getBridgeClient } from './WebSocketClient';
import {
  BridgeStreamMessage,
  ExecResult,
  ListDirEntry,
} from './types';

/** Execute a shell command in Termux */
export async function exec(
  command: string,
  cwd?: string,
  onStream?: (stream: 'stdout' | 'stderr', data: string) => void,
): Promise<ExecResult> {
  const client = getBridgeClient();
  const result = await client.send<ExecResult>(
    'exec',
    { command, cwd },
    onStream
      ? (msg: BridgeStreamMessage) => onStream(msg.stream, msg.data)
      : undefined,
    120000, // 2 minute timeout for commands
  );
  return result;
}

/** Read a file's contents */
export async function readFile(path: string): Promise<string> {
  const client = getBridgeClient();
  const response = await client.send<{ content: string; path: string }>('read_file', { path });
  return response.content;
}

/** Write content to a file (creates parent directories if needed) */
export async function writeFile(path: string, content: string): Promise<void> {
  const client = getBridgeClient();
  await client.send('write_file', { path, content });
}

/** List directory contents */
export async function listDir(path: string): Promise<ListDirEntry[]> {
  const client = getBridgeClient();
  const response = await client.send<{ path: string; entries: ListDirEntry[] }>('list_dir', { path });
  return response.entries;
}

/** Delete a file */
export async function deleteFile(path: string): Promise<void> {
  const client = getBridgeClient();
  await client.send('delete_file', { path });
}

/** Get git diff output */
export async function gitDiff(cwd: string): Promise<string> {
  const client = getBridgeClient();
  return client.send<string>('git_diff', { cwd });
}

/** Create a git commit */
export async function gitCommit(cwd: string, message: string): Promise<string> {
  const client = getBridgeClient();
  return client.send<string>('git_commit', { cwd, message });
}
