// Bridge connection state store
// Tracks WebSocket connection status with the Termux bridge server

import { create } from 'zustand';
import { ConnectionState } from '../bridge/types';
import { getBridgeClient, resetBridgeClient } from '../bridge/WebSocketClient';

interface BridgeState {
  connectionState: ConnectionState;
  errorMessage: string | null;

  // Actions
  connect: (url: string, token: string) => void;
  disconnect: () => void;
}

export const useBridgeStore = create<BridgeState>((set) => ({
  connectionState: 'disconnected',
  errorMessage: null,

  connect: (url: string, token: string) => {
    const client = getBridgeClient();
    client.updateConfig(url, token);

    client.onStateChange = (state: ConnectionState) => {
      set({ connectionState: state, errorMessage: null });
    };

    client.onError = (error: string) => {
      set({ errorMessage: error });
    };

    client.connect();
  },

  disconnect: () => {
    resetBridgeClient();
    set({ connectionState: 'disconnected', errorMessage: null });
  },
}));
