// Secure storage wrapper using expo-secure-store

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  OPENCODE_URL: 'vibeshell_opencode_url',
  OPENCODE_PASSWORD: 'vibeshell_opencode_password',
  BRIDGE_TOKEN: 'vibeshell_bridge_token',
  BRIDGE_URL: 'vibeshell_bridge_url',
  ONBOARDING_SEEN: 'vibeshell_onboarding_seen',
  MODEL: 'vibeshell_model',
  AGENT: 'vibeshell_agent',
} as const;

export async function getOpenCodeUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.OPENCODE_URL);
}

export async function setOpenCodeUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.OPENCODE_URL, url);
}

export async function getOpenCodePassword(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.OPENCODE_PASSWORD);
}

export async function setOpenCodePassword(password: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.OPENCODE_PASSWORD, password);
}

export async function getBridgeToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.BRIDGE_TOKEN);
}

export async function setBridgeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.BRIDGE_TOKEN, token);
}

export async function getBridgeUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.BRIDGE_URL);
}

export async function setBridgeUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.BRIDGE_URL, url);
}

export async function getOnboardingSeen(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEYS.ONBOARDING_SEEN);
  return val === 'true';
}

export async function setOnboardingSeen(seen: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ONBOARDING_SEEN, seen ? 'true' : 'false');
}

export async function getModel(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.MODEL);
}

export async function setModel(model: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.MODEL, model);
}

export async function getAgent(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.AGENT);
}

export async function setAgent(agent: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.AGENT, agent);
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.OPENCODE_URL),
    SecureStore.deleteItemAsync(KEYS.OPENCODE_PASSWORD),
    SecureStore.deleteItemAsync(KEYS.BRIDGE_TOKEN),
    SecureStore.deleteItemAsync(KEYS.BRIDGE_URL),
    SecureStore.deleteItemAsync(KEYS.MODEL),
    SecureStore.deleteItemAsync(KEYS.AGENT),
  ]);
}
