package com.vibeshell.app.bridge

import android.content.Context
import android.util.Log
import java.io.*
import java.util.zip.GZIPInputStream

object RootfsManager {
    private const val TAG = "RootfsManager"
    private const val ROOTFS_ASSET = "rootfs/rootfs.tar.gz"
    private const val ROOTFS_SENTINEL = ".rootfs_extracted"

    fun isRootfsExtracted(context: Context): Boolean {
        val rootfsDir = File(context.filesDir, "rootfs")
        val sentinel = File(rootfsDir, ROOTFS_SENTINEL)
        return sentinel.exists() && rootfsDir.list()?.isNotEmpty() == true
    }

    fun getRootfsDir(context: Context): File? {
        val rootfsDir = File(context.filesDir, "rootfs")

        if (isRootfsExtracted(context)) {
            Log.i(TAG, "Rootfs already extracted at ${rootfsDir.absolutePath}")
            return rootfsDir
        }

        return try {
            extractRootfs(context, rootfsDir)
            val sentinel = File(rootfsDir, ROOTFS_SENTINEL)
            sentinel.writeText(System.currentTimeMillis().toString())
            rootfsDir
        } catch (e: Exception) {
            Log.e(TAG, "Failed to extract rootfs", e)
            rootfsDir.deleteRecursively()
            null
        }
    }

    private fun extractRootfs(context: Context, destDir: File) {
        Log.i(TAG, "Extracting rootfs from assets...")
        destDir.mkdirs()

        context.assets.open(ROOTFS_ASSET).use { assetInputStream ->
            GZIPInputStream(BufferedInputStream(assetInputStream, 8192)).use { gzipStream ->
                extractTar(gzipStream, destDir)
            }
        }

        Log.i(TAG, "Rootfs extracted to ${destDir.absolutePath}")
    }

    private fun extractTar(inputStream: InputStream, destDir: File) {
        val header = ByteArray(512)

        while (true) {
            val bytesRead = readFully(inputStream, header)
            if (bytesRead < 512) break
            if (header.all { it == 0.toByte() }) break

            val name = String(header, 0, 100).trim { it <= '\u0000' }
            val sizeStr = String(header, 124, 12).trim { it <= '\u0000' }
            val size = sizeStr.toLongOrNull(8) ?: 0L
            val type = header[156].toInt().toChar()
            val linkname = String(header, 157, 100).trim { it <= '\u0000' }
            val modeStr = String(header, 100, 8).trim { it <= '\u0000' }
            val mode = modeStr.toLongOrNull(8) ?: 0L

            val fullPath = File(destDir, name)

            when (type) {
                '0', '\u0000' -> {
                    fullPath.parentFile?.mkdirs()
                    FileOutputStream(fullPath).use { fos ->
                        copyStream(inputStream, fos, size)
                    }
                    if (mode and 0b111_000_000 != 0L) {
                        fullPath.setExecutable(true, false)
                    }
                    fullPath.setReadable(true, false)
                }
                '1', '2' -> {
                    fullPath.parentFile?.mkdirs()
                    ProcessBuilder("ln", "-sf", linkname, fullPath.absolutePath)
                        .start().waitFor()
                }
                '5' -> {
                    fullPath.mkdirs()
                }
                else -> {
                    if (size > 0) {
                        copyStream(inputStream, ByteArrayOutputStream(), size)
                    }
                }
            }

            val padding = (512 - (size % 512).toInt()) % 512
            if (padding > 0) {
                inputStream.skip(padding.toLong())
            }
        }
    }

    private fun readFully(inputStream: InputStream, buffer: ByteArray): Int {
        var offset = 0
        while (offset < buffer.size) {
            val read = inputStream.read(buffer, offset, buffer.size - offset)
            if (read == -1) break
            offset += read
        }
        return offset
    }

    private fun copyStream(input: InputStream, output: OutputStream, bytesToCopy: Long) {
        val buffer = ByteArray(8192)
        var remaining = bytesToCopy
        while (remaining > 0) {
            val toRead = minOf(buffer.size.toLong(), remaining).toInt()
            val read = input.read(buffer, 0, toRead)
            if (read == -1) break
            output.write(buffer, 0, read)
            remaining -= read
        }
    }
}
