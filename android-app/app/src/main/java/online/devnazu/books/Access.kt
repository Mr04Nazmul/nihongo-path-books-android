package online.devnazu.books

import java.net.URI

object Access {
    val levels = listOf("N5", "N4", "N3", "N2", "N1")
    val thresholds = mapOf("N5" to listOf(2,5,10,20), "N4" to listOf(3,8,12,24), "N3" to listOf(4,10,16,30), "N2" to listOf(5,12,20,36), "N1" to listOf(6,15,25,45))
    fun internal(url: String): Boolean = try {
        val u = URI(url)
        u.scheme == "https" && u.host == "appassets.androidplatform.net" && u.port == -1 && u.userInfo == null &&
            u.path.startsWith("/assets/reader/") && !u.path.contains("..") && !u.path.contains('\\')
    } catch (_: Exception) { false }
    fun readerScreen(route:String)=route.substringBefore('?').substringBefore('#') in setOf("study.html","kanji.html","listening.html","basics/index.html")
    fun contentLevel(path:String):String? {
        val match=Regex("^(?:data/(?:lessons-|listening-)?|kanji/|strokes/|audio/(?:listening/)?|listening/)(n[1-5])(?:[./-])",RegexOption.IGNORE_CASE).find(path)
        return match?.groupValues?.get(1)?.uppercase()
    }
    fun previewAsset(path:String,level:String?):String? {
        if(level !in levels || contentLevel(path)!=level)return null
        if(path=="data/lessons-${level!!.lowercase()}.json")return "reader/previews/"+path.substringAfterLast('/')
        if(path=="kanji/${level!!.lowercase()}.json")return "reader/previews/kanji/"+path.substringAfterLast('/')
        if(Regex("^strokes/n[1-5]/[0-9a-f]{5}.json$").matches(path))return "reader/previews/"+path
        return null
    }
    // Catalogue has titles, counts and paths only; paid question media/keys stay remote.
    fun freeListeningAsset(path:String,level:String?):String? {
        if(level !in levels || contentLevel(path)!=level)return null
        val prefix="listening/${level!!.lowercase()}/"
        if(path==prefix+"catalog.json" || Regex("^"+prefix+"2012/g[12]/(?:audio\\.mp3|answers\\.json|[pq][0-9]+\\.webp)$").matches(path))return "reader/previews/"+path
        return null
    }
    fun remaining(expiry: Long, serverNow: Long) = (expiry - serverNow).coerceAtLeast(0)
}
