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

    private fun log(msg: String) {
        val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
        Log.i(TAG, "[$ts] $msg")
    }

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
        isBridgeRunning = false
        isOpenCodeRunning = false

        val notification = buildNotification("Baslatiliyor...")
        startForeground(NOTIFICATION_ID, notification,
            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)

        acquireWakeLock()

        Thread {
            val totalStart = System.currentTimeMillis()
            try {
                // === STEP 1: Extract proot bundle ===
                val t1 = System.currentTimeMillis()
                log("STEP 1: Extracting proot bundle...")
                updateNotification("Proot cikariliyor...")

                val prootBundleDir = AssetExtractor.extractProotBundle(applicationContext)
                log("STEP 1: prootBundleDir = ${prootBundleDir.absolutePath}")
                log("STEP 1: prootBundleDir exists = ${prootBundleDir.exists()}")
                log("STEP 1: prootBundleDir files = ${prootBundleDir.listFiles()?.map { it.name }}")

                val prootBin = AssetExtractor.getProotPath(applicationContext)
                log("STEP 1: prootBin = ${prootBin.absolutePath}, exists=${prootBin.exists()}, size=${prootBin.length()}, executable=${prootBin.canExecute()}")

                val prootLibDir = AssetExtractor.getProotLibPath(applicationContext)
                log("STEP 1: prootLibDir = ${prootLibDir.absolutePath}, exists=${prootLibDir.exists()}")
                prootLibDir.listFiles()?.forEach { f ->
                    log("STEP 1:   lib: ${f.name} (${f.length()} bytes)")
                }

                if (!prootBin.exists()) throw IllegalStateException("proot binary not found at ${prootBin.absolutePath}")
                if (!prootBin.canExecute()) {
                    log("STEP 1: Setting proot binary executable...")
                    prootBin.setExecutable(true, false)
                }
                log("STEP 1 done in ${System.currentTimeMillis() - t1}ms")

                // === STEP 2: Extract rootfs ===
                val t2 = System.currentTimeMillis()
                log("STEP 2: Extracting rootfs...")
                updateNotification("Rootfs cikariliyor...")

                val rootfsDir = RootfsManager.getRootfsDir(applicationContext)
                if (rootfsDir == null) throw IllegalStateException("Rootfs cikarilamadi - RootfsManager returned null")
                log("STEP 2: rootfsDir = ${rootfsDir.absolutePath}")
                log("STEP 2: rootfsDir exists = ${rootfsDir.exists()}")
                log("STEP 2: rootfsDir contents = ${rootfsDir.listFiles()?.map { it.name }}")

                // Verify key paths exist inside rootfs
                val nodeBin = File(rootfsDir, "usr/local/bin/node")
                val opencodeBin = File(rootfsDir, "usr/local/bin/opencode")
                val bridgeDir = File(rootfsDir, "root/bridge")
                log("STEP 2: node binary = ${nodeBin.absolutePath}, exists=${nodeBin.exists()}, size=${nodeBin.length()}")
                log("STEP 2: opencode binary = ${opencodeBin.absolutePath}, exists=${opencodeBin.exists()}")
                log("STEP 2: bridge dir = ${bridgeDir.absolutePath}, exists=${bridgeDir.exists()}")
                log("STEP 2: bridge/node_modules exists = ${File(bridgeDir, "node_modules").exists()}")
                log("STEP 2 done in ${System.currentTimeMillis() - t2}ms")

                // === STEP 3: Start bridge server ===
                val t3 = System.currentTimeMillis()
                log("STEP 3: Starting bridge server...")
                updateNotification("Bridge baslatiliyor...")

                startBridgeServer(prootBin, rootfsDir, prootLibDir)

                log("STEP 3: Waiting for bridge on port 8765...")
                waitForBridge(60)
                log("STEP 3 done in ${System.currentTimeMillis() - t3}ms - Bridge is UP")

                // === STEP 4: Start OpenCode server ===
                val t4 = System.currentTimeMillis()
                log("STEP 4: Starting OpenCode server...")
                updateNotification("OpenCode baslatiliyor...")

                startOpenCodeServer(prootBin, rootfsDir, prootLibDir)

                log("STEP 4: Waiting for OpenCode on port 4096...")
                waitForOpenCode(60)
                log("STEP 4 done in ${System.currentTimeMillis() - t4}ms - OpenCode is UP")

                // === ALL DONE ===
                val totalMs = System.currentTimeMillis() - totalStart
                log("ALL STEPS DONE in ${totalMs}ms")
                updateNotification("VibeShell calisiyor")

                startHealthCheck()

            } catch (e: Exception) {
                val totalMs = System.currentTimeMillis() - totalStart
                Log.e(TAG, "Startup FAILED after ${totalMs}ms", e)
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

        log("BRIDGE CMD: ${cmd.joinToString(" ")}")

        val env = mapOf(
            "HOME" to "/root",
            "PATH" to "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "NODE_ENV" to "production",
            "LD_LIBRARY_PATH" to prootLibDir.absolutePath
        )

        log("BRIDGE ENV: LD_LIBRARY_PATH=${prootLibDir.absolutePath}")

        bridgeProcess = launchProcess(cmd, env)
        log("BRIDGE process started, pid=${bridgeProcess?.toString()}")

        // Stream stdout
        Thread {
            BufferedReader(InputStreamReader(bridgeProcess!!.inputStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.d(TAG, "[bridge stdout] $line")
                    sendEventToJS("BRIDGE_STDOUT", line!!)
                }
            }
            log("BRIDGE stdout stream ended")
        }.start()

        // Stream stderr
        Thread {
            BufferedReader(InputStreamReader(bridgeProcess!!.errorStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.w(TAG, "[bridge stderr] $line")
                    sendEventToJS("BRIDGE_STDERR", line!!)
                }
            }
            log("BRIDGE stderr stream ended")
        }.start()

        // Monitor exit
        Thread {
            val exitCode = bridgeProcess?.waitFor()
            isBridgeRunning = false
            Log.w(TAG, "Bridge process EXITED with code: $exitCode")
            sendEventToJS("BRIDGE_EXIT", exitCode?.toString() ?: "-1")

            if (!shouldStop) {
                updateNotification("Bridge yeniden baslatiliyor...")
                Thread.sleep(3000)
                if (!shouldStop) {
                    try {
                        log("BRIDGE restarting...")
                        val prootBin2 = AssetExtractor.getProotPath(applicationContext)
                        val prootLib2 = AssetExtractor.getProotLibPath(applicationContext)
                        startBridgeServer(prootBin2, rootfsDir, prootLib2)
                    } catch (e: Exception) {
                        Log.e(TAG, "Bridge restart failed", e)
                    }
                }
            }
        }.start()
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

        log("OPENCODE CMD: ${cmd.joinToString(" ")}")

        val env = mapOf(
            "HOME" to "/root",
            "PATH" to "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "NODE_ENV" to "production",
            "LD_LIBRARY_PATH" to prootLibDir.absolutePath
        )

        opencodeProcess = launchProcess(cmd, env)
        log("OPENCODE process started, pid=${opencodeProcess?.toString()}")

        // Stream stdout
        Thread {
            BufferedReader(InputStreamReader(opencodeProcess!!.inputStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.d(TAG, "[opencode stdout] $line")
                    sendEventToJS("OPENCODE_STDOUT", line!!)
                }
            }
            log("OPENCODE stdout stream ended")
        }.start()

        // Stream stderr
        Thread {
            BufferedReader(InputStreamReader(opencodeProcess!!.errorStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.w(TAG, "[opencode stderr] $line")
                    sendEventToJS("OPENCODE_STDERR", line!!)
                }
            }
            log("OPENCODE stderr stream ended")
        }.start()

        // Monitor exit
        Thread {
            val exitCode = opencodeProcess?.waitFor()
            isOpenCodeRunning = false
            Log.w(TAG, "OpenCode process EXITED with code: $exitCode")
            sendEventToJS("OPENCODE_EXIT", exitCode?.toString() ?: "-1")

            if (!shouldStop) {
                updateNotification("OpenCode yeniden baslatiliyor...")
                Thread.sleep(3000)
                if (!shouldStop) {
                    try {
                        log("OPENCODE restarting...")
                        val prootBin2 = AssetExtractor.getProotPath(applicationContext)
                        val prootLib2 = AssetExtractor.getProotLibPath(applicationContext)
                        startOpenCodeServer(prootBin2, rootfsDir, prootLib2)
                    } catch (e: Exception) {
                        Log.e(TAG, "OpenCode restart failed", e)
                    }
                }
            }
        }.start()
    }

    private fun launchProcess(cmd: List<String>, env: Map<String, String>): Process {
        val pb = ProcessBuilder(cmd)
        pb.redirectErrorStream(false)
        pb.environment().putAll(env)
        pb.directory(File("/"))
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

        log("PROOT CMD: ${cmd.joinToString(" ")}")

        val env = mutableMapOf(
            "HOME" to "/root",
            "PATH" to "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        )
        if (prootLibDir != null) {
            env["LD_LIBRARY_PATH"] = prootLibDir.absolutePath
        }

        val process = launchProcess(cmd, env)

        // Stream output
        Thread {
            BufferedReader(InputStreamReader(process.inputStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    log("PROOT stdout: $line")
                }
            }
        }.start()
        Thread {
            BufferedReader(InputStreamReader(process.errorStream)).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    Log.w(TAG, "PROOT stderr: $line")
                }
            }
        }.start()

        val exitCode = process.waitFor()
        log("PROOT command exited: $exitCode")
    }

    private fun waitForBridge(timeoutSeconds: Int) {
        var attempts = 0
        while (attempts < timeoutSeconds) {
            try {
                val socket = java.net.Socket("127.0.0.1", 8765)
                socket.close()
                isBridgeRunning = true
                log("BRIDGE ready after ${attempts}s on port 8765")
                return
            } catch (e: java.net.ConnectException) {
                if (attempts % 10 == 0) {
                    log("BRIDGE port 8765 not ready (attempt ${attempts + 1}/${timeoutSeconds}): ${e.message}")
                }
            } catch (e: Exception) {
                if (attempts % 10 == 0) {
                    log("BRIDGE port 8765 check error (attempt ${attempts + 1}/${timeoutSeconds}): ${e.javaClass.simpleName}: ${e.message}")
                }
            }
            Thread.sleep(1000)
            attempts++
        }
        throw IllegalStateException("Bridge did not start within ${timeoutSeconds}s on port 8765")
    }

    private fun waitForOpenCode(timeoutSeconds: Int) {
        var attempts = 0
        while (attempts < timeoutSeconds) {
            try {
                val conn = URL("http://127.0.0.1:4096/global/health").openConnection() as HttpURLConnection
                conn.connectTimeout = 2000
                conn.readTimeout = 2000
                conn.requestMethod = "GET"
                val code = conn.responseCode
                conn.disconnect()
                if (code == 200) {
                    isOpenCodeRunning = true
                    log("OPENCODE ready after ${attempts}s on port 4096 (HTTP $code)")
                    return
                }
                if (attempts % 10 == 0) {
                    log("OPENCODE health returned HTTP $code (attempt ${attempts + 1}/${timeoutSeconds})")
                }
            } catch (e: java.net.ConnectException) {
                if (attempts % 10 == 0) {
                    log("OPENCODE port 4096 not ready (attempt ${attempts + 1}/${timeoutSeconds}): ${e.message}")
                }
            } catch (e: Exception) {
                if (attempts % 10 == 0) {
                    log("OPENCODE health check error (attempt ${attempts + 1}/${timeoutSeconds}): ${e.javaClass.simpleName}: ${e.message}")
                }
            }
            Thread.sleep(1000)
            attempts++
        }
        throw IllegalStateException("OpenCode did not start within ${timeoutSeconds}s on port 4096")
    }

    private fun startHealthCheck() {
        healthCheckThread = Thread {
            while (!Thread.currentThread().isInterrupted && !shouldStop) {
                try {
                    Thread.sleep(5000)

                    // Check bridge
                    var bridgeOk = false
                    try {
                        val s = java.net.Socket("127.0.0.1", 8765)
                        s.close()
                        bridgeOk = true
                    } catch (_: Exception) {}

                    if (!bridgeOk) {
                        isBridgeRunning = false
                        Log.w(TAG, "HEALTH: Bridge DOWN")
                        sendEventToJS("HEALTH_CHECK", "bridge_down")
                    }

                    // Check OpenCode
                    var opencodeOk = false
                    try {
                        val conn = URL("http://127.0.0.1:4096/global/health").openConnection() as HttpURLConnection
                        conn.connectTimeout = 2000
                        conn.readTimeout = 2000
                        conn.requestMethod = "GET"
                        opencodeOk = conn.responseCode == 200
                        conn.disconnect()
                    } catch (_: Exception) {}

                    if (!opencodeOk) {
                        isOpenCodeRunning = false
                        Log.w(TAG, "HEALTH: OpenCode DOWN")
                        sendEventToJS("HEALTH_CHECK", "opencode_down")
                    }

                    val status = "Bridge=${if (isBridgeRunning) "UP" else "DOWN"} OpenCode=${if (isOpenCodeRunning) "UP" else "DOWN"}"
                    log("HEALTH: $status")
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
