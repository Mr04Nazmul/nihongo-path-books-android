package online.devnazu.books

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ApiError(val code: Int, message: String): IllegalStateException(message)

class BooksApi(private val token: () -> String) {
    private val client=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(45,TimeUnit.SECONDS).followRedirects(false).build()
    val configured get()=BuildConfig.API_BASE.startsWith("https://")
    fun request(path: String, method: String="GET", data: JSONObject?=null): JSONObject {
        check(configured) { "Study server setup is pending. Free basics are available offline." }
        val b=Request.Builder().url(BuildConfig.API_BASE.trimEnd('/')+path).header("Authorization","Bearer "+token())
        if(method!="GET")b.method(method,(data?:JSONObject()).toString().toRequestBody("application/json".toMediaType()))
        client.newCall(b.build()).execute().use { r ->
            val json=JSONObject(r.body?.string()?:"{}")
            if(!r.isSuccessful)throw ApiError(r.code,json.optString("error","Please try again later"))
            return json
        }
    }
    fun uploadAudio(stream:java.io.InputStream):JSONObject {
        check(configured) { "Server setup pending" }
        val output=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192)
        while(true){val count=stream.read(buffer);if(count<0)break;check(output.size()+count<=20000000){"Audio exceeds 20 MB"};output.write(buffer,0,count)}
        val request=Request.Builder().url(BuildConfig.API_BASE.trimEnd('/')+"/admin/audio-upload").header("Authorization","Bearer "+token()).post(output.toByteArray().toRequestBody("audio/mpeg".toMediaType())).build()
        client.newCall(request).execute().use { response ->val result=JSONObject(response.body?.string()?:"{}");if(!response.isSuccessful)throw ApiError(response.code,result.optString("error","Audio upload failed"));return result}
    }
    fun content(path: String): Pair<String,ByteArray> {
        check(configured) { "Server setup pending" }
        val encoded=path.split('/').joinToString("/") { java.net.URLEncoder.encode(it,"UTF-8").replace("+","%20") }
        val req=Request.Builder().url(BuildConfig.API_BASE.trimEnd('/')+"/content/"+encoded).header("Authorization","Bearer "+token()).header("Cache-Control","no-store").build()
        client.newCall(req).execute().use { r ->
            check(r.isSuccessful) { "Access unavailable" }
            return (r.header("Content-Type")?:"application/octet-stream") to (r.body?.bytes()?:byteArrayOf())
        }
    }
}
