/**
 * ProotModule - Native Bridge for Proot Management
 *
 * Android native module wrapper for controlling proot Linux environment,
 * foreground service, and process lifecycle.
 */

import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

export interface BridgeStatus {
  prootInstalled: boolean;
  rootfsExtracted: boolean;
  serviceRunning: boolean;
  bridgeRunning: boolean;
  opencodeRunning: boolean;
}

interface IProotModule {
  startBridgeService(): Promise<boolean>;
  stopBridgeService(): Promise<boolean>;
  isBridgeRunning(): Promise<boolean>;
  isProotInstalled(): Promise<boolean>;
  getBridgeStatus(): Promise<BridgeStatus>;
  requestBatteryOptimizationExemption(): Promise<boolean>;
  isBatteryOptimizationDisabled(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const LINKING_ERROR =
  `The package 'vibeshell-proot' doesn't seem to be linked. Make sure:\n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go (proot requires native code)\n';

const ProotModuleNative: IProotModule = NativeModules.ProotModule
  ? NativeModules.ProotModule
  : new Proxy(
      {} as any,
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export default ProotModuleNative;

// Event emitter for native events
export const ProotEventEmitter = new NativeEventEmitter(ProotModuleNative);

// Event types emitted by BridgeForegroundService
export type ProotEvent =
  | { type: 'BRIDGE_STDOUT'; data: string }
  | { type: 'BRIDGE_STDERR'; data: string }
  | { type: 'BRIDGE_EXIT'; data: string }
  | { type: 'OPENCODE_STDOUT'; data: string }
  | { type: 'OPENCODE_STDERR'; data: string }
  | { type: 'OPENCODE_EXIT'; data: string }
  | { type: 'HEALTH_CHECK'; data: string }
  | { type: 'SERVICE_ERROR'; data: string };

/**
 * High-level convenience class for managing the proot environment
 */
export class ProotManager {
  private static instance: ProotManager;

  private constructor() {}

  static getInstance(): ProotManager {
    if (!ProotManager.instance) {
      ProotManager.instance = new ProotManager();
    }
    return ProotManager.instance;
  }

  async startBridge(): Promise<void> {
    const status = await ProotModuleNative.getBridgeStatus();
    if (status.serviceRunning && status.bridgeRunning && status.opencodeRunning) {
      console.log('[ProotManager] All services already running');
      return;
    }
    console.log('[ProotManager] Starting services...');
    await ProotModuleNative.startBridgeService();
  }

  async stopBridge(): Promise<void> {
    console.log('[ProotManager] Stopping services...');
    await ProotModuleNative.stopBridgeService();
  }

  async getStatus(): Promise<BridgeStatus> {
    return await ProotModuleNative.getBridgeStatus();
  }

  async isProotInstalled(): Promise<boolean> {
    return await ProotModuleNative.isProotInstalled();
  }

  async ensureBatteryOptimization(): Promise<boolean> {
    try {
      const isDisabled = await ProotModuleNative.isBatteryOptimizationDisabled();
      if (isDisabled) return false;
      return await ProotModuleNative.requestBatteryOptimizationExemption();
    } catch {
      return false;
    }
  }
}
