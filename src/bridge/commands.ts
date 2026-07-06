// Bridge command helpers (v2 — exec only)

import { getBridgeClient } from './WebSocketClient';
import { BridgeStreamMessage, ExecResult } from './types';

/** Execute a shell command via the bridge */
export async function exec(
  command: string,
  cwd?: string,
  onStream?: (stream: 'stdout' | 'stderr', data: string) => void,
): Promise<ExecResult> {
  const client = getBridgeClient();
  return client.send<ExecResult>(
    'exec',
    { command, cwd },
    onStream
      ? (msg: BridgeStreamMessage) => onStream(msg.stream, msg.data)
      : undefined,
    120000,
  );
}
