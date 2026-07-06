// OpenCode client wrapper — connects to a running opencode serve instance

import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/client';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4096';

let clientInstance: OpencodeClient | null = null;

/**
 * Get or create the OpenCode client singleton.
 */
export function getOpenCodeClient(
  baseUrl: string = DEFAULT_BASE_URL,
  password?: string,
): OpencodeClient {
  if (clientInstance) return clientInstance;

  const headers: Record<string, string> = {};
  if (password) {
    const encoded = btoa(`opencode:${password}`);
    headers['Authorization'] = `Basic ${encoded}`;
  }

  clientInstance = createOpencodeClient({
    baseUrl,
    headers,
  });

  return clientInstance;
}

/** Reset the client (e.g. on config change) */
export function resetOpenCodeClient(): void {
  clientInstance = null;
}

/** Check if the OpenCode server is reachable */
export async function checkHealth(baseUrl: string = DEFAULT_BASE_URL): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/global/health`);
    const data = await res.json();
    return data.healthy === true;
  } catch {
    return false;
  }
}

export type { OpencodeClient as Client };
