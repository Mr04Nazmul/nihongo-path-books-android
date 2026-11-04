package online.devnazu.books
import android.content.Context
import android.graphics.Bitmap
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
@RunWith(AndroidJUnit4::class)
class ListeningUiTest {
 @Test fun twoFreeGroupsUseRealMediaAndProductionAccessChecks(){
  val inst=InstrumentationRegistry.getInstrumentation();val ctx=inst.targetContext
  ctx.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putBoolean("introduced",true).putString("appearance","dark").commit();TokenVault(ctx).clear()
  ActivityScenario.launch(MainActivity::class.java).use { scenario ->
   fun js(script:String):String{var result="";val latch=CountDownLatch(1);scenario.onActivity{a->val web=MainActivity::class.java.getDeclaredField("web").apply{isAccessible=true}.get(a) as WebView;web.evaluateJavascript(script){result=it;latch.countDown()}};check(latch.await(10,TimeUnit.SECONDS));return result}
   fun ready(expression:String){var done=false;for(i in 0..90){if(js(expression)=="true"){done=true;break};Thread.sleep(500)};check(done){"Reader condition failed: $expression"}}
   for(level in listOf("N5","N3","N1")){
    scenario.onActivity{a->
     MainActivity::class.java.getDeclaredMethod("openListening",String::class.java).apply{isAccessible=true}.invoke(a,level)
     val web=MainActivity::class.java.getDeclaredField("web").apply{isAccessible=true}.get(a) as WebView
     web.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE,null)
    }
    ready("document.querySelectorAll('[data-section]').length>0")
    assertEquals("2",js("document.querySelectorAll('[data-section]:not(.reward-locked)').length"))
    assertEquals("true",js("document.querySelector('[data-section]').dataset.section==='2012-${level.lowercase()}-g1'"))
    // Exercise the actual native interceptor. Test fixtures never replace access checks.
    js("window.deniedChecks=[];Promise.all(['listening/${level.lowercase()}/2018/g1/audio.mp3','listening/${level.lowercase()}/2009/g1/audio.mp3','listening/${if(level=="N1")"n5" else "n1"}/catalog.json'].map(p=>fetch(p).then(r=>r.status))).then(x=>window.deniedChecks=x);true")
    ready("window.deniedChecks.length===3");assertEquals("true",js("window.deniedChecks.every(x=>x===403)"))
    js("window.rangeCheck=null;fetch('listening/${level.lowercase()}/2012/g1/audio.mp3',{headers:{Range:'bytes=0-31'}}).then(r=>r.arrayBuffer().then(b=>window.rangeCheck={status:r.status,length:b.byteLength,range:r.headers.get('Content-Range')}));true")
    ready("window.rangeCheck!==null");assertEquals("true",js("window.rangeCheck.status===206 && window.rangeCheck.length===32 && window.rangeCheck.range.indexOf('bytes 0-31/')===0"))
    js("document.querySelector('[data-section]').click();true")
    ready("document.querySelectorAll('.questionImage').length>0 && Array.from(document.querySelectorAll('.questionImage')).every(x=>x.complete && x.naturalWidth>0)")
    ready("document.querySelector('#time').textContent.indexOf('--:--')===-1")
    assertEquals("true",js("document.documentElement.scrollWidth<=window.innerWidth"))
    js("document.querySelector('[data-answer=\"2\"]').click();document.querySelector('#flag').click();document.querySelector('#next').click();true")
    assertEquals("true",js("document.querySelector('[data-q=\"1\"]').classList.contains('selected')"))
    js("document.querySelector('#previous').click();true")
    assertEquals("true",js("document.querySelector('[data-answer=\"2\"]').getAttribute('aria-pressed')==='true'"))
    assertEquals("true",js("document.querySelector('#flag').classList.contains('active')"))
    Thread.sleep(1200)
    scenario.onActivity{a->val decor=a.window.decorView;val b=Bitmap.createBitmap(decor.width,decor.height,Bitmap.Config.ARGB_8888);decor.draw(android.graphics.Canvas(b));java.io.File(ctx.filesDir,"listening-${level.lowercase()}-actual.png").outputStream().use{b.compress(Bitmap.CompressFormat.PNG,100,it)};b.recycle()}
    scenario.onActivity{a->MainActivity::class.java.getDeclaredMethod("closeReader").apply{isAccessible=true}.invoke(a)}
   }
  }
 }
}
