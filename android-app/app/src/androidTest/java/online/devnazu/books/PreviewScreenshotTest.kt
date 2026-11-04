package online.devnazu.books

import android.content.Context
import android.view.WindowManager
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith

/** Captures the running debug application; production window protection stays unchanged. */
@RunWith(AndroidJUnit4::class)
@androidx.test.filters.SdkSuppress(minSdkVersion = 26)
class PreviewScreenshotTest {
    @Test fun capturePreviewPages() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        context.getSharedPreferences("MainActivity", Context.MODE_PRIVATE).edit()
            .putBoolean("introduced", true).putString("appearance", "dark").commit()
        TokenVault(context).clear()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            fun capture(name: String) {
                val latch = java.util.concurrent.CountDownLatch(1)
                var result = -1
                var bitmap: android.graphics.Bitmap? = null
                scenario.onActivity { a ->
                    val decor = a.window.decorView
                    bitmap = android.graphics.Bitmap.createBitmap(decor.width, decor.height, android.graphics.Bitmap.Config.ARGB_8888)
                    android.view.PixelCopy.request(a.window, bitmap!!, { status -> result = status; latch.countDown() }, android.os.Handler(android.os.Looper.getMainLooper()))
                }
                check(latch.await(20, java.util.concurrent.TimeUnit.SECONDS) && result == android.view.PixelCopy.SUCCESS) { "App window capture failed: $result" }
                java.io.File(context.filesDir, "$name.png").outputStream().use {
                    bitmap!!.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                }
                bitmap!!.recycle()
            }
            scenario.onActivity { a -> a.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
            Thread.sleep(1200)
            capture("home")
            scenario.onActivity { a ->
                MainActivity::class.java.getDeclaredField("tab").apply { isAccessible = true }.set(a, "Quiz")
                MainActivity::class.java.getDeclaredMethod("draw").apply { isAccessible = true }.invoke(a)
            }
            Thread.sleep(500)
            capture("mock-test")
            scenario.onActivity { a ->
                MainActivity::class.java.getDeclaredField("tab").apply { isAccessible = true }.set(a, "Progress")
                MainActivity::class.java.getDeclaredMethod("draw").apply { isAccessible = true }.invoke(a)
            }
            scenario.onActivity { a ->
                val web = MainActivity::class.java.getDeclaredField("web").apply { isAccessible = true }.get(a) as android.webkit.WebView
                web.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null)
            }
            var ready = false
            for (attempt in 0 until 60) {
                val latch = java.util.concurrent.CountDownLatch(1)
                scenario.onActivity { a ->
                    val web = MainActivity::class.java.getDeclaredField("web").apply { isAccessible = true }.get(a) as android.webkit.WebView
                    web.evaluateJavascript("document.querySelectorAll('.tile').length === 10 && !!document.querySelector('#animation svg')") { value -> ready = value == "true"; latch.countDown() }
                }
                latch.await(5, java.util.concurrent.TimeUnit.SECONDS)
                if (ready) break
                Thread.sleep(1000)
            }
            check(ready) { "Kanji tiles and verified SVG did not finish loading" }
            Thread.sleep(3000)
            capture("kanji")
            scenario.onActivity { a -> a.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) }
        }
    }
}
