package online.devnazu.books

import java.net.URI

object Access {
    val levels = listOf("N5", "N4", "N3", "N2")
    val thresholds = mapOf("N5" to listOf(2,5,10,20), "N4" to listOf(3,8,12,24), "N3" to listOf(4,10,16,30), "N2" to listOf(5,12,20,36))
    fun internal(url: String): Boolean = try {
        val u = URI(url)
        u.scheme == "https" && u.host == "appassets.androidplatform.net" && u.port == -1 && u.userInfo == null &&
            u.path.startsWith("/assets/reader/") && !u.path.contains("..") && !u.path.contains('\\')
    } catch (_: Exception) { false }
    fun remaining(expiry: Long, serverNow: Long) = (expiry - serverNow).coerceAtLeast(0)
}
