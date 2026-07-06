package com.vibeshell.app.bridge

import android.content.Context
import android.util.Log
import java.io.*
import java.util.zip.GZIPInputStream

object RootfsManager {
    private const val TAG = "RootfsManager"
    private const val ROOTFS_ASSET = "rootfs/rootfs.tar.gz"
    private const val ROOTFS_SENTINEL = ".rootfs_extracted"

    private fun log(msg: String) {
        val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
        Log.i(TAG, "[$ts] $msg")
    }

    fun isRootfsExtracted(context: Context): Boolean {
        val rootfsDir = File(context.filesDir, "rootfs")
        val sentinel = File(rootfsDir, ROOTFS_SENTINEL)
        val extracted = sentinel.exists() && rootfsDir.list()?.isNotEmpty() == true
        log("isRootfsExtracted=$extracted (sentinel=${sentinel.exists()}, files=${rootfsDir.listFiles()?.size ?: 0})")
        return extracted
    }

    fun getRootfsDir(context: Context): File? {
        val rootfsDir = File(context.filesDir, "rootfs")

        if (isRootfsExtracted(context)) {
            log("Rootfs already extracted at ${rootfsDir.absolutePath}")
            return rootfsDir
        }

        return try {
            extractRootfs(context, rootfsDir)
            val sentinel = File(rootfsDir, ROOTFS_SENTINEL)
            sentinel.writeText(System.currentTimeMillis().toString())
            log("Rootfs extraction complete: ${rootfsDir.absolutePath}")
            log("Rootfs contents: ${rootfsDir.listFiles()?.map { it.name }}")
            rootfsDir
        } catch (e: Exception) {
            Log.e(TAG, "Failed to extract rootfs", e)
            rootfsDir.deleteRecursively()
            null
        }
    }

    private fun extractRootfs(context: Context, destDir: File) {
        log("Starting rootfs extraction from assets...")
        val startTime = System.currentTimeMillis()
        destDir.mkdirs()

        context.assets.open(ROOTFS_ASSET).use { assetInputStream ->
            val totalSize = context.assets.openFd(ROOTFS_ASSET).use { it.length }
            log("Asset size: ${totalSize / 1024 / 1024}MB (${totalSize} bytes)")

            GZIPInputStream(BufferedInputStream(assetInputStream, 16384)).use { gzipStream ->
                extractTar(gzipStream, destDir)
            }
        }

        val elapsed = System.currentTimeMillis() - startTime
        val fileCount = countFiles(destDir)
        log("Extraction complete: $fileCount files in ${elapsed}ms (${elapsed / 1000}s)")
    }

    private fun countFiles(dir: File): Int {
        var count = 0
        dir.listFiles()?.forEach { f ->
            count++
            if (f.isDirectory) count += countFiles(f)
        }
        return count
    }

    private fun extractTar(inputStream: InputStream, destDir: File) {
        val header = ByteArray(512)
        var fileCount = 0
        var totalBytes = 0L
        val startTime = System.currentTimeMillis()

        while (true) {
            val bytesRead = readFully(inputStream, header)
            if (bytesRead < 512) {
                log("TAR: reached end of stream after $fileCount files")
                break
            }
            if (header.all { it == 0.toByte() }) {
                log("TAR: null header after $fileCount files")
                break
            }

            val name = String(header, 0, 100).trim { it <= '\u0000' }
            val sizeStr = String(header, 124, 12).trim { it <= '\u0000' }
            val size = sizeStr.toLongOrNull(8) ?: run {
                Log.w(TAG, "TAR: failed to parse size for '$name', sizeStr='$sizeStr', defaulting to 0")
                0L
            }
            val type = header[156].toInt().toChar()
            val linkname = String(header, 157, 100).trim { it <= '\u0000' }
            val modeStr = String(header, 100, 8).trim { it <= '\u0000' }
            val mode = modeStr.toLongOrNull(8) ?: run {
                Log.w(TAG, "TAR: failed to parse mode for '$name', modeStr='$modeStr', defaulting to 0")
                0L
            }

            val fullPath = File(destDir, name)

            when (type) {
                '0', '\u0000' -> {
                    fullPath.parentFile?.mkdirs()
                    FileOutputStream(fullPath).use { fos ->
                        copyStream(inputStream, fos, size)
                    }
                    totalBytes += size
                    if (mode and 0b111_000_000 != 0L) {
                        fullPath.setExecutable(true, false)
                    }
                    fullPath.setReadable(true, false)
                }
                '1', '2' -> {
                    fullPath.parentFile?.mkdirs()
                    val result = ProcessBuilder("ln", "-sf", linkname, fullPath.absolutePath)
                        .start().waitFor()
                    if (result != 0) {
                        Log.w(TAG, "TAR: symlink failed for '$name' -> '$linkname' (exit=$result)")
                    }
                }
                '5' -> {
                    fullPath.mkdirs()
                }
                else -> {
                    Log.w(TAG, "TAR: unknown type '$type' for '$name' (size=$size), skipping")
                    if (size > 0) {
                        copyStream(inputStream, ByteArrayOutputStream(), size)
                    }
                }
            }

            fileCount++
            if (fileCount % 100 == 0) {
                val elapsed = System.currentTimeMillis() - startTime
                log("TAR progress: $fileCount files, ${totalBytes / 1024}KB extracted, ${elapsed}ms elapsed, current: $name")
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
        val buffer = ByteArray(16384)
        var remaining = bytesToCopy
        while (remaining > 0) {
            val toRead = minOf(buffer.size.toLong(), remaining).toInt()
            val read = input.read(buffer, 0, toRead)
            if (read == -1) {
                Log.w(TAG, "TAR: truncated archive - expected $remaining more bytes")
                break
            }
            output.write(buffer, 0, read)
            remaining -= read
        }
    }
}
