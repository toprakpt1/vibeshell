package com.vibeshell.app.bridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.vibeshell.app.MainActivity
import com.vibeshell.app.R
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class BridgeForegroundService : Service() {

    companion object {
        const val ACTION_START = "com.vibeshell.app.bridge.START"
        const val ACTION_STOP = "com.vibeshell.app.bridge.STOP"
        const val NOTIFICATION_CHANNEL_ID = "vibeshell_bridge"
        const val NOTIFICATION_ID = 1
        private const val TAG = "BridgeService"

        @Volatile
        var isRunning = false
            private set

        @Volatile
        var isBridgeRunning = false
            private set

        @Volatile
        var isOpenCodeRunning = false
            private set
    }

    private var bridgeProcess: Process? = null
    private var opencodeProcess: Process? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var healthCheckThread: Thread? = null
    @Volatile private var shouldStop = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()

        when (intent?.action) {
            ACTION_START -> startAll()
            ACTION_STOP -> stopAll()
        }

        return START_STICKY
    }

    private fun startAll() {
        shouldStop = false
        isRunning = true

        val notification = buildNotification("Baslatiliyor...")
        startForeground(NOTIFICATION_ID, notification,
            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)

        acquireWakeLock()

        Thread {
            try {
                // Step 1: Extract proot bundle + rootfs
                updateNotification("Dosyalar cikariliyor...")
                val prootBundleDir = AssetExtractor.extractProotBundle(applicationContext)
                val prootBin = AssetExtractor.getProotPath(applicationContext)
                val prootLibDir = AssetExtractor.getProotLibPath(applicationContext)

                // Step 2: Extract rootfs
                updateNotification("Rootfs cikariliyor...")
                val rootfsDir = RootfsManager.getRootfsDir(applicationContext)
                    ?: throw IllegalStateException("Rootfs cikarilamadi")

                // Step 3: Start bridge server
                updateNotification("Bridge sunucusu baslatiliyor...")
                startBridgeServer(prootBin, rootfsDir, prootLibDir)
                waitForBridge(60)

                // Step 4: Start OpenCode server
                updateNotification("OpenCode sunucusu baslatiliyor...")
                startOpenCodeServer(prootBin, rootfsDir, prootLibDir)
                waitForOpenCode(60)

                updateNotification("VibeShell calisiyor")

                // Step 6: Start health check
                startHealthCheck()

            } catch (e: Exception) {
                Log.e(TAG, "Startup failed", e)
                updateNotification("Hata: ${e.message}")
                sendEventToJS("SERVICE_ERROR", e.message ?: "Unknown error")
            }
        }.start()
    }

    private fun stopAll() {
        shouldStop = true
        isRunning = false
        isBridgeRunning = false
        isOpenCodeRunning = false

        healthCheckThread?.interrupt()
        bridgeProcess?.destroy()
        opencodeProcess?.destroy()

        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startBridgeServer(prootBin: File, rootfsDir: File, prootLibDir: File) {
        val cmd = listOf(
            prootBin.absolutePath,
            "-r", rootfsDir.absolutePath,
            "-0",
            "--link2symlink",
            "-w", "/root",
            "/bin/sh", "-c",
            "cd /root/bridge && exec node server.js"
        )

        val env = mapOf(
            "HOME" to "/root",
            "PATH" to "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "NODE_ENV" to "production",
            "LD_LIBRARY_PATH" to prootLibDir.absolutePath
        )

        bridgeProcess = launchProcess(cmd, env)

        // Stream stdout
        Thread {
            BufferedReader(InputStreamReader(bridgeProcess!!.inputStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.d(TAG, "[bridge] $line")
                    sendEventToJS("BRIDGE_STDOUT", line!!)
                }
            }
        }.start()

        // Stream stderr
        Thread {
            BufferedReader(InputStreamReader(bridgeProcess!!.errorStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.w(TAG, "[bridge err] $line")
                    sendEventToJS("BRIDGE_STDERR", line!!)
                }
            }
        }.start()

        // Monitor exit
        Thread {
            val exitCode = bridgeProcess?.waitFor()
            isBridgeRunning = false
            Log.w(TAG, "Bridge exited with code: $exitCode")
            sendEventToJS("BRIDGE_EXIT", exitCode?.toString() ?: "-1")

            if (!shouldStop) {
                updateNotification("Bridge yeniden baslatiliyor...")
                Thread.sleep(3000)
                if (!shouldStop) {
                    try {
                        val prootBin2 = AssetExtractor.getProotPath(applicationContext)
                        val prootLib2 = AssetExtractor.getProotLibPath(applicationContext)
                        startBridgeServer(prootBin2, rootfsDir, prootLib2)
                    } catch (e: Exception) {
                        Log.e(TAG, "Bridge restart failed", e)
                    }
                }
            }
        }.start()

        isBridgeRunning = true
    }

    private fun startOpenCodeServer(prootBin: File, rootfsDir: File, prootLibDir: File) {
        val cmd = listOf(
            prootBin.absolutePath,
            "-r", rootfsDir.absolutePath,
            "-0",
            "--link2symlink",
            "-w", "/root",
            "/bin/sh", "-c",
            "exec opencode serve --hostname 0.0.0.0 --port 4096"
        )

        val env = mapOf(
            "HOME" to "/root",
            "PATH" to "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "NODE_ENV" to "production",
            "LD_LIBRARY_PATH" to prootLibDir.absolutePath
        )

        opencodeProcess = launchProcess(cmd, env)

        // Stream stdout
        Thread {
            BufferedReader(InputStreamReader(opencodeProcess!!.inputStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.d(TAG, "[opencode] $line")
                    sendEventToJS("OPENCODE_STDOUT", line!!)
                }
            }
        }.start()

        // Stream stderr
        Thread {
            BufferedReader(InputStreamReader(opencodeProcess!!.errorStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.w(TAG, "[opencode err] $line")
                    sendEventToJS("OPENCODE_STDERR", line!!)
                }
            }
        }.start()

        // Monitor exit
        Thread {
            val exitCode = opencodeProcess?.waitFor()
            isOpenCodeRunning = false
            Log.w(TAG, "OpenCode exited with code: $exitCode")
            sendEventToJS("OPENCODE_EXIT", exitCode?.toString() ?: "-1")

            if (!shouldStop) {
                updateNotification("OpenCode yeniden baslatiliyor...")
                Thread.sleep(3000)
                if (!shouldStop) {
                    try {
                        val prootBin2 = AssetExtractor.getProotPath(applicationContext)
                        val prootLib2 = AssetExtractor.getProotLibPath(applicationContext)
                        startOpenCodeServer(prootBin2, rootfsDir, prootLib2)
                    } catch (e: Exception) {
                        Log.e(TAG, "OpenCode restart failed", e)
                    }
                }
            }
        }.start()

        isOpenCodeRunning = true
    }

    private fun launchProcess(cmd: List<String>, env: Map<String, String>): Process {
        val pb = ProcessBuilder(cmd)
        pb.redirectErrorStream(false)
        pb.environment().putAll(env)
        return pb.start()
    }

    private fun runProotCommand(prootBin: File, rootfsDir: File, command: String, prootLibDir: File? = null) {
        val cmd = listOf(
            prootBin.absolutePath,
            "-r", rootfsDir.absolutePath,
            "-0",
            "--link2symlink",
            "-w", "/root",
            "/bin/sh", "-c",
            command
        )

        val env = mutableMapOf(
            "HOME" to "/root",
            "PATH" to "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        )
        if (prootLibDir != null) {
            env["LD_LIBRARY_PATH"] = prootLibDir.absolutePath
        }

        val process = launchProcess(cmd, env)
        val exitCode = process.waitFor()
        Log.i(TAG, "Proot command exited: $exitCode")
    }

    private fun waitForBridge(timeoutSeconds: Int) {
        var attempts = 0
        while (attempts < timeoutSeconds) {
            if (isPortOpen(8765)) {
                isBridgeRunning = true
                Log.i(TAG, "Bridge is ready")
                return
            }
            Thread.sleep(1000)
            attempts++
        }
        Log.w(TAG, "Bridge did not become ready within ${timeoutSeconds}s")
    }

    private fun waitForOpenCode(timeoutSeconds: Int) {
        var attempts = 0
        while (attempts < timeoutSeconds) {
            if (isHttpOk("http://127.0.0.1:4096/global/health")) {
                isOpenCodeRunning = true
                Log.i(TAG, "OpenCode is ready")
                return
            }
            Thread.sleep(1000)
            attempts++
        }
        Log.w(TAG, "OpenCode did not become ready within ${timeoutSeconds}s")
    }

    private fun isPortOpen(port: Int): Boolean {
        return try {
            val socket = java.net.Socket("127.0.0.1", port)
            socket.close()
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun isHttpOk(url: String): Boolean {
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 2000
            conn.readTimeout = 2000
            conn.requestMethod = "GET"
            val code = conn.responseCode
            conn.disconnect()
            code == 200
        } catch (e: Exception) {
            false
        }
    }

    private fun startHealthCheck() {
        healthCheckThread = Thread {
            while (!Thread.currentThread().isInterrupted && !shouldStop) {
                try {
                    Thread.sleep(5000)

                    // Check bridge
                    if (!isPortOpen(8765)) {
                        isBridgeRunning = false
                        Log.w(TAG, "Bridge health check failed")
                        sendEventToJS("HEALTH_CHECK", "bridge_down")
                    }

                    // Check OpenCode
                    if (!isHttpOk("http://127.0.0.1:4096/global/health")) {
                        isOpenCodeRunning = false
                        Log.w(TAG, "OpenCode health check failed")
                        sendEventToJS("HEALTH_CHECK", "opencode_down")
                    }

                    // Update notification
                    val status = buildString {
                        append("Bridge")
                        append(if (isBridgeRunning) " ✓" else " ✗")
                        append(" | OpenCode")
                        append(if (isOpenCodeRunning) " ✓" else " ✗")
                    }
                    updateNotification(status)

                } catch (e: InterruptedException) {
                    break
                }
            }
        }
        healthCheckThread?.start()
    }

    private fun sendEventToJS(eventName: String, data: String) {
        try {
            val reactContext = (application as? com.facebook.react.ReactApplication)
                ?.reactHost
                ?.currentReactContext

            reactContext?.getJSModule(
                DeviceEventManagerModule.RCTDeviceEventEmitter::class.java
            )?.emit(eventName, data)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event to JS: $eventName", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "VibeShell Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "VibeShell bridge and OpenCode servers"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("VibeShell")
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "vibeshell::bridge_wakelock"
        ).apply { acquire(4 * 60 * 60 * 1000L) }
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAll()
    }
}
