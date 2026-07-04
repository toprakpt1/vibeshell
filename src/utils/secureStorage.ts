// Secure storage wrapper using expo-secure-store
// Used for storing API keys and auth tokens

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  API_KEY: 'vibeshell_api_key',
  BRIDGE_TOKEN: 'vibeshell_bridge_token',
  PROVIDER: 'vibeshell_provider',
  MODEL: 'vibeshell_model',
} as const;

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.API_KEY, key);
}

export async function getBridgeToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.BRIDGE_TOKEN);
}

export async function setBridgeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.BRIDGE_TOKEN, token);
}

export async function getProvider(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.PROVIDER);
}

export async function setProvider(provider: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PROVIDER, provider);
}

export async function getModel(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.MODEL);
}

export async function setModel(model: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.MODEL, model);
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.API_KEY),
    SecureStore.deleteItemAsync(KEYS.BRIDGE_TOKEN),
    SecureStore.deleteItemAsync(KEYS.PROVIDER),
    SecureStore.deleteItemAsync(KEYS.MODEL),
  ]);
}
