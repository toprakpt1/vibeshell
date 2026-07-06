package com.vibeshell.app.bridge

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ProotModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ProotModule"

    @ReactMethod
    fun startBridgeService(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val intent = Intent(ctx, BridgeForegroundService::class.java).apply {
                action = BridgeForegroundService.ACTION_START
            }
            ctx.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ProotModule", "startBridgeService failed", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopBridgeService(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val intent = Intent(ctx, BridgeForegroundService::class.java).apply {
                action = BridgeForegroundService.ACTION_STOP
            }
            ctx.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ProotModule", "stopBridgeService failed", e)
            promise.reject("SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isBridgeRunning(promise: Promise) {
        promise.resolve(BridgeForegroundService.isRunning)
    }

    @ReactMethod
    fun getBridgeStatus(promise: Promise) {
        try {
            val prootOk = AssetExtractor.isProotBundleExtracted(reactApplicationContext)
            val rootfsOk = RootfsManager.isRootfsExtracted(reactApplicationContext)
            val svcRunning = BridgeForegroundService.isRunning
            val bridgeOk = BridgeForegroundService.isBridgeRunning
            val ocOk = BridgeForegroundService.isOpenCodeRunning

            Log.i("ProotModule", "STATUS: proot=$prootOk rootfs=$rootfsOk service=$svcRunning bridge=$bridgeOk opencode=$ocOk")

            val status = Arguments.createMap().apply {
                putBoolean("prootInstalled", prootOk)
                putBoolean("rootfsExtracted", rootfsOk)
                putBoolean("serviceRunning", svcRunning)
                putBoolean("bridgeRunning", bridgeOk)
                putBoolean("opencodeRunning", ocOk)
            }
            promise.resolve(status)
        } catch (e: Exception) {
            Log.e("ProotModule", "getBridgeStatus failed", e)
            promise.reject("STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isProotInstalled(promise: Promise) {
        promise.resolve(AssetExtractor.isProotBundleExtracted(reactApplicationContext))
    }

    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        try {
            val intent = Intent(
                android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
            ).apply {
                data = android.net.Uri.parse("package:${reactApplicationContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ProotModule", "requestBatteryOptimizationExemption failed", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isBatteryOptimizationDisabled(promise: Promise) {
        val pm = reactApplicationContext.getSystemService(
            android.content.Context.POWER_SERVICE
        ) as android.os.PowerManager
        promise.resolve(pm.isIgnoringBatteryOptimizations(
            reactApplicationContext.packageName
        ))
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }
}
