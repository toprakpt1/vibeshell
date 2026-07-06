package com.vibeshell.app.bridge

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

object AssetExtractor {
    private const val TAG = "AssetExtractor"

    private fun log(msg: String) {
        val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
        Log.i(TAG, "[$ts] $msg")
    }

    fun extractAsset(context: Context, assetName: String, outputDir: File): File {
        val outputFile = File(outputDir, assetName)

        if (outputFile.exists() && outputFile.length() > 0) {
            log("SKIP $assetName (already extracted, ${outputFile.length()} bytes)")
            return outputFile
        }

        // If file exists but is 0 bytes (corrupted), delete and re-extract
        if (outputFile.exists() && outputFile.length() == 0L) {
            Log.w(TAG, "DELETING empty file $assetName (corrupted from previous extraction)")
            outputFile.delete()
        }

        outputFile.parentFile?.mkdirs()

        try {
            context.assets.open(assetName).use { inputStream ->
                val size = inputStream.available()
                log("EXTRACT $assetName (${size} bytes)")
                FileOutputStream(outputFile).use { outputStream ->
                    val buffer = ByteArray(8 * 1024)
                    var bytesRead: Int
                    var totalWritten = 0L
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                        totalWritten += bytesRead
                    }
                    outputStream.flush()
                }
            }

            if (!assetName.endsWith(".so") && !assetName.endsWith(".json") && !assetName.endsWith(".lock")) {
                outputFile.setExecutable(true, false)
            }
            outputFile.setReadable(true, false)

            log("EXTRACTED $assetName -> ${outputFile.absolutePath} (${outputFile.length()} bytes)")
            return outputFile
        } catch (e: IOException) {
            Log.e(TAG, "FAILED to extract $assetName", e)
            throw e
        }
    }

    fun extractProotBundle(context: Context): File {
        val bundleDir = File(context.filesDir, "proot-bundle")

        if (isProotBundleExtracted(context)) {
            log("Bundle already extracted at ${bundleDir.absolutePath}")
            return bundleDir
        }

        log("Extracting proot bundle from assets...")
        val startTime = System.currentTimeMillis()
        bundleDir.mkdirs()

        try {
            extractAssetTree(context, "proot-bundle", bundleDir)
            val elapsed = System.currentTimeMillis() - startTime
            log("Proot bundle extracted in ${elapsed}ms to ${bundleDir.absolutePath}")

            // Validate all critical files
            val prootBin = File(bundleDir, "bin/proot")
            val loader = File(bundleDir, "libexec/loader")
            val libtalloc = File(bundleDir, "lib/libtalloc.so.2")
            val libshmem = File(bundleDir, "lib/libandroid-shmem.so")

            log("VALIDATION: bin/proot exists=${prootBin.exists()} size=${prootBin.length()} exec=${prootBin.canExecute()}")
            log("VALIDATION: libexec/loader exists=${loader.exists()} size=${loader.length()}")
            log("VALIDATION: lib/libtalloc.so.2 exists=${libtalloc.exists()} size=${libtalloc.length()}")
            log("VALIDATION: lib/libandroid-shmem.so exists=${libshmem.exists()} size=${libshmem.length()}")

            if (!prootBin.exists()) throw IllegalStateException("proot binary missing after extraction")
            if (prootBin.length() == 0L) throw IllegalStateException("proot binary is empty (0 bytes)")
            if (!prootBin.canExecute()) {
                log("Setting proot binary executable...")
                prootBin.setExecutable(true, false)
            }

            return bundleDir
        } catch (e: Exception) {
            Log.e(TAG, "Failed to extract proot bundle", e)
            bundleDir.deleteRecursively()
            throw e
        }
    }

    private fun extractAssetTree(context: Context, assetPath: String, outputDir: File) {
        try {
            val list = context.assets.list(assetPath)
            if (list.isNullOrEmpty()) {
                // Leaf file - extract it
                val parentPath = assetPath.substringBeforeLast("/")
                val fileName = assetPath.substringAfterLast("/")
                extractAsset(context, assetPath, File(outputDir, "."))
            } else {
                // Directory - recurse
                for (child in list) {
                    val childAssetPath = if (assetPath.isEmpty()) child else "$assetPath/$child"
                    val childOutputFile = File(outputDir, child)
                    if (childOutputFile.isDirectory || list.isNotEmpty()) {
                        childOutputFile.mkdirs()
                        extractAssetTree(context, childAssetPath, childOutputFile)
                    }
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "Error extracting asset tree: $assetPath", e)
            throw e
        }
    }

    fun isProotBundleExtracted(context: Context): Boolean {
        val bundleDir = File(context.filesDir, "proot-bundle")
        val prootBin = File(bundleDir, "bin/proot")
        val loader = File(bundleDir, "libexec/loader")
        val libtalloc = File(bundleDir, "lib/libtalloc.so.2")

        val result = prootBin.exists() && prootBin.length() > 0 && prootBin.canExecute() &&
                loader.exists() && loader.length() > 0 &&
                libtalloc.exists() && libtalloc.length() > 0

        if (!result) {
            log("VALIDATION FAILED: proot=${prootBin.exists()}/${prootBin.length()}/${prootBin.canExecute()} " +
                    "loader=${loader.exists()}/${loader.length()} " +
                    "libtalloc=${libtalloc.exists()}/${libtalloc.length()}")
        }

        return result
    }

    fun getProotPath(context: Context): File {
        return File(context.filesDir, "proot-bundle/bin/proot")
    }

    fun getProotLibPath(context: Context): File {
        return File(context.filesDir, "proot-bundle/lib")
    }
}
