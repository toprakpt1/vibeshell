// WebSocket client for Termux bridge server communication
// Handles connection management, request/response matching, and auto-reconnect

import {
  BridgeRequest,
  BridgeResponse,
  BridgeStreamMessage,
  ConnectionState,
} from './types';

type MessageHandler = (data: BridgeResponse | BridgeStreamMessage) => void;

const DEFAULT_URL = 'ws://127.0.0.1:8765';
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const REQUEST_TIMEOUT = 30000;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private authToken: string;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    streamHandler?: (data: BridgeStreamMessage) => void;
  }>();
  private requestCounter = 0;

  // Event callbacks
  public onStateChange?: (state: ConnectionState) => void;
  public onError?: (error: string) => void;

  private _state: ConnectionState = 'disconnected';

  get state(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    this.onStateChange?.(state);
  }

  constructor(url: string = DEFAULT_URL, authToken: string = '') {
    this.url = url;
    this.authToken = authToken;
  }

  /** Connect to the bridge server */
  connect(): void {
    if (this.ws && (this._state === 'connected' || this._state === 'connecting')) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        // Send auth token as first message
        if (this.authToken) {
          this.ws?.send(JSON.stringify({ type: 'auth', token: this.authToken }));
        }
        this.setState('connected');
      };

      this.ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);
          this.handleMessage(data);
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      this.ws.onerror = (event: Event) => {
        console.error('[WebSocket] Error:', event);
        this.onError?.(`Bridge not reachable at ${this.url} — is the Termux bridge server running?`);
        this.setState('error');
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.rejectAllPending('Connection closed');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  /** Disconnect from the bridge server */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.rejectAllPending('Disconnected');
    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /** Send a request and wait for response */
  async send<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    streamHandler?: (data: BridgeStreamMessage) => void,
    timeout: number = REQUEST_TIMEOUT,
  ): Promise<T> {
    if (this._state !== 'connected' || !this.ws) {
      throw new Error('Not connected to bridge server');
    }

    const id = `req_${++this.requestCounter}_${Date.now()}`;
    const request: BridgeRequest = {
      id,
      method: method as BridgeRequest['method'],
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
        streamHandler,
      });

      this.ws!.send(JSON.stringify(request));
    });
  }

  /** Update connection config */
  updateConfig(url: string, authToken: string): void {
    const needsReconnect = url !== this.url || authToken !== this.authToken;
    this.url = url;
    this.authToken = authToken;
    if (needsReconnect && this._state === 'connected') {
      this.disconnect();
      this.connect();
    }
  }

  private handleMessage(data: BridgeResponse | BridgeStreamMessage): void {
    const id = data.id;
    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    // Handle stream messages (for exec)
    if ('stream' in data && data.stream) {
      pending.streamHandler?.(data as BridgeStreamMessage);
      return;
    }

    // Handle final response
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    const response = data as BridgeResponse;
    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance
let clientInstance: WebSocketClient | null = null;

export function getBridgeClient(): WebSocketClient {
  if (!clientInstance) {
    clientInstance = new WebSocketClient();
  }
  return clientInstance;
}

export function resetBridgeClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}
