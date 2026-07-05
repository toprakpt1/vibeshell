/**
 * ProotModule - Native Bridge for Proot Management
 * 
 * Android native module wrapper for controlling proot Linux environment
 * and foreground service lifecycle.
 */

import { NativeModules, Platform } from 'react-native';

interface IProotModule {
  /**
   * Start the bridge foreground service
   * This will spawn proot + Node.js bridge server
   */
  startBridgeService(): Promise<boolean>;
  
  /**
   * Stop the bridge foreground service
   * This will terminate proot process cleanly
   */
  stopBridgeService(): Promise<boolean>;
  
  /**
   * Check if bridge service is currently running
   */
  isBridgeRunning(): Promise<boolean>;
  
  /**
   * Request battery optimization exemption
   * Opens system settings for user to whitelist the app
   */
  requestBatteryOptimizationExemption(): Promise<boolean>;
  
  /**
   * Check if battery optimization is disabled for this app
   */
  isBatteryOptimizationDisabled(): Promise<boolean>;
}

// Type-safe native module
const LINKING_ERROR =
  `The package 'vibeshell-proot' doesn't seem to be linked. Make sure:\n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go (proot requires native code)\n';

const ProotModule: IProotModule = NativeModules.ProotModule
  ? NativeModules.ProotModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export default ProotModule;

/**
 * High-level convenience functions
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
  
  /**
   * Initialize and start bridge service
   */
  async startBridge(): Promise<void> {
    try {
      const isRunning = await ProotModule.isBridgeRunning();
      if (isRunning) {
        console.log('[ProotManager] Bridge already running');
        return;
      }
      
      console.log('[ProotManager] Starting bridge service...');
      await ProotModule.startBridgeService();
      console.log('[ProotManager] Bridge service started');
    } catch (error) {
      console.error('[ProotManager] Failed to start bridge:', error);
      throw error;
    }
  }
  
  /**
   * Stop bridge service
   */
  async stopBridge(): Promise<void> {
    try {
      console.log('[ProotManager] Stopping bridge service...');
      await ProotModule.stopBridgeService();
      console.log('[ProotManager] Bridge service stopped');
    } catch (error) {
      console.error('[ProotManager] Failed to stop bridge:', error);
      throw error;
    }
  }
  
  /**
   * Check bridge status
   */
  async isBridgeRunning(): Promise<boolean> {
    return await ProotModule.isBridgeRunning();
  }
  
  /**
   * Request battery optimization exemption
   * Returns true if user needs to grant permission, false if already exempt
   */
  async ensureBatteryOptimization(): Promise<boolean> {
    try {
      const isDisabled = await ProotModule.isBatteryOptimizationDisabled();
      if (isDisabled) {
        console.log('[ProotManager] Battery optimization already disabled');
        return false;
      }
      
      console.log('[ProotManager] Requesting battery optimization exemption...');
      const requested = await ProotModule.requestBatteryOptimizationExemption();
      return requested;
    } catch (error) {
      console.error('[ProotManager] Battery optimization check failed:', error);
      return false;
    }
  }
}
