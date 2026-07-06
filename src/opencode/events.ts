// OpenCode event stream handler
// Handles real-time events from the OpenCode server via SSE
//
// React Native doesn't have native EventSource support, so we use
// fetch with manual SSE parsing or polling as fallback.

import type { Client } from './client';

export type OpenCodeEventType =
  | 'server.connected'
  | 'session.created'
  | 'session.updated'
  | 'session.deleted'
  | 'message.created'
  | 'message.updated'
  | 'message.part.created'
  | 'message.part.updated'
  | 'permission.asked'
  | 'permission.answered'
  | 'todo.updated'
  | 'file.written'
  | 'file.deleted'
  | 'file.rewritten'
  | 'shell.executed'
  | 'step.started'
  | 'step.finished'
  | string;

export interface OpenCodeEvent {
  type: OpenCodeEventType;
  properties: Record<string, unknown>;
  sessionID?: string;
  messageID?: string;
}

type EventHandler = (event: OpenCodeEvent) => void;

class OpenCodeEventSource {
  private client: Client;
  private baseUrl: string;
  private headers: Record<string, string>;
  private handlers = new Map<string, Set<EventHandler>>();
  private abortController: AbortController | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(client: Client, baseUrl: string, headers: Record<string, string> = {}) {
    this.client = client;
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  /** Subscribe to all events */
  subscribe(handler: EventHandler): () => void {
    if (!this.handlers.has('*')) {
      this.handlers.set('*', new Set());
    }
    this.handlers.get('*')!.add(handler);

    if (!this.connected) {
      this.connect();
    }

    return () => {
      this.handlers.get('*')?.delete(handler);
      if (this.handlers.get('*')?.size === 0) {
        this.disconnect();
      }
    };
  }

  /** Subscribe to a specific event type */
  on(type: OpenCodeEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    if (!this.connected) {
      this.connect();
    }

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  private async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.baseUrl}/event`, {
        headers: {
          Accept: 'text/event-stream',
          ...this.headers,
        },
        signal: this.abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          } else if (line === '' && eventData) {
            this.handleEvent(eventType || 'message', eventData);
            eventType = '';
            eventData = '';
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[OpenCode SSE] Connection error:', err.message);
        this.scheduleReconnect();
      }
    } finally {
      this.connected = false;
    }
  }

  private handleEvent(type: string, data: string): void {
    try {
      const parsed = JSON.parse(data);
      const event: OpenCodeEvent = {
        type,
        properties: parsed,
        sessionID: parsed.sessionID,
        messageID: parsed.messageID,
      };

      // Notify type-specific handlers
      this.handlers.get(type)?.forEach((h) => h(event));
      // Notify wildcard handlers
      this.handlers.get('*')?.forEach((h) => h(event));
    } catch {
      // Non-JSON events (like server.connected)
      const event: OpenCodeEvent = { type, properties: { raw: data } };
      this.handlers.get(type)?.forEach((h) => h(event));
      this.handlers.get('*')?.forEach((h) => h(event));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  disconnect(): void {
    this.connected = false;
    this.abortController?.abort();
    this.abortController = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

let eventSourceInstance: OpenCodeEventSource | null = null;

export function getEventSource(
  client: Client,
  baseUrl: string,
  headers?: Record<string, string>,
): OpenCodeEventSource {
  if (!eventSourceInstance) {
    eventSourceInstance = new OpenCodeEventSource(client, baseUrl, headers);
  }
  return eventSourceInstance;
}

export function resetEventSource(): void {
  eventSourceInstance?.disconnect();
  eventSourceInstance = null;
}
