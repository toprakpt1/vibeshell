// OpenCode session helpers — high-level API for session management

import type { Client } from './client';
import type { Session, Message, Agent } from './types';

/** Create a new session for a workspace */
export async function createSession(
  client: Client,
  title: string,
): Promise<Session> {
  const result = await client.session.create({ body: { title } });
  return result.data as Session;
}

/** List all sessions */
export async function listSessions(client: Client): Promise<Session[]> {
  const result = await client.session.list();
  return (result.data || []) as Session[];
}

/** Get a session by ID */
export async function getSession(
  client: Client,
  sessionId: string,
): Promise<Session> {
  const result = await client.session.get({ path: { id: sessionId } });
  return result.data as Session;
}

/** Delete a session */
export async function deleteSession(
  client: Client,
  sessionId: string,
): Promise<void> {
  await client.session.delete({ path: { id: sessionId } });
}

/** Get messages in a session */
export async function getMessages(
  client: Client,
  sessionId: string,
): Promise<{ info: Message; parts: any[] }[]> {
  const result = await client.session.messages({ path: { id: sessionId } });
  return (result.data || []) as { info: Message; parts: any[] }[];
}

/** Send a message and wait for the full response (synchronous) */
export async function sendMessage(
  client: Client,
  sessionId: string,
  text: string,
  options?: {
    model?: { providerID: string; modelID: string };
    agent?: string;
  },
): Promise<{ info: Message; parts: any[] }> {
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: 'text', text }],
      ...(options?.model && { model: options.model }),
      ...(options?.agent && { agent: options.agent }),
    },
  });
  return result.data as { info: Message; parts: any[] };
}

/** Send a message asynchronously (fire and forget, use SSE for updates) */
export async function sendMessageAsync(
  client: Client,
  sessionId: string,
  text: string,
  options?: {
    model?: { providerID: string; modelID: string };
    agent?: string;
  },
): Promise<void> {
  await client.session.promptAsync({
    path: { id: sessionId },
    body: {
      parts: [{ type: 'text', text }],
      ...(options?.model && { model: options.model }),
      ...(options?.agent && { agent: options.agent }),
    },
  });
}

/** Abort a running session */
export async function abortSession(
  client: Client,
  sessionId: string,
): Promise<void> {
  await client.session.abort({ path: { id: sessionId } });
}

/** Get available agents */
export async function getAgents(client: Client): Promise<Agent[]> {
  const result = await client.app.agents();
  return (result.data || []) as Agent[];
}

/** Get diff for a session */
export async function getSessionDiff(
  client: Client,
  sessionId: string,
): Promise<any[]> {
  const result = await client.session.diff({ path: { id: sessionId } });
  return (result.data || []) as any[];
}

/** Respond to a permission request */
export async function respondToPermission(
  client: Client,
  sessionId: string,
  permissionId: string,
  response: 'once' | 'always' | 'reject',
): Promise<void> {
  await client.postSessionIdPermissionsPermissionId({
    path: { id: sessionId, permissionID: permissionId },
    body: { response },
  });
}
