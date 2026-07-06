package com.vibeshell.app.bridge

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

object AssetExtractor {
    private const val TAG = "AssetExtractor"

    fun extractAsset(context: Context, assetName: String, outputDir: File): File {
        val outputFile = File(outputDir, assetName)

        if (outputFile.exists() && outputFile.length() > 0) {
            return outputFile
        }

        outputFile.parentFile?.mkdirs()

        try {
            context.assets.open(assetName).use { inputStream ->
                FileOutputStream(outputFile).use { outputStream ->
                    val buffer = ByteArray(8 * 1024)
                    var bytesRead: Int
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                    }
                    outputStream.flush()
                }
            }

            if (!assetName.endsWith(".so") && !assetName.endsWith(".json") && !assetName.endsWith(".lock")) {
                outputFile.setExecutable(true, false)
            }
            outputFile.setReadable(true, false)

            Log.i(TAG, "Extracted $assetName -> ${outputFile.absolutePath} (${outputFile.length()} bytes)")
            return outputFile
        } catch (e: IOException) {
            Log.e(TAG, "Failed to extract asset $assetName", e)
            throw e
        }
    }

    fun extractProotBundle(context: Context): File {
        val bundleDir = File(context.filesDir, "proot-bundle")

        if (isProotBundleExtracted(context)) {
            return bundleDir
        }

        Log.i(TAG, "Extracting proot bundle from assets...")
        bundleDir.mkdirs()

        try {
            extractAssetTree(context, "proot-bundle", bundleDir)
            Log.i(TAG, "Proot bundle extracted to ${bundleDir.absolutePath}")
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
                extractAsset(context, assetPath, outputDir)
            } else {
                for (child in list) {
                    val childAssetPath = if (assetPath.isEmpty()) child else "$assetPath/$child"
                    val childOutputDir = File(outputDir, child)
                    if (list.isNotEmpty()) {
                        childOutputDir.mkdirs()
                        extractAssetTree(context, childAssetPath, childOutputDir)
                    } else {
                        extractAsset(context, childAssetPath, outputDir)
                    }
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "Error extracting asset tree: $assetPath", e)
        }
    }

    fun isProotBundleExtracted(context: Context): Boolean {
        val bundleDir = File(context.filesDir, "proot-bundle")
        val prootBin = File(bundleDir, "bin/proot")
        return prootBin.exists() && prootBin.length() > 0 && prootBin.canExecute()
    }

    fun getProotPath(context: Context): File {
        return File(context.filesDir, "proot-bundle/bin/proot")
    }

    fun getProotLibPath(context: Context): File {
        return File(context.filesDir, "proot-bundle/lib")
    }
}
