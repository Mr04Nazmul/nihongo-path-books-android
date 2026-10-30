package online.devnazu.books
import android.view.WindowManager
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
@RunWith(AndroidJUnit4::class)
class ProtectionTest {
 @org.junit.Before fun skipIntroductionForNavigationTests(){
  androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getSharedPreferences("MainActivity",android.content.Context.MODE_PRIVATE).edit().putBoolean("introduced",true).commit()
 }

 @Test fun profileUsesNativePreferencesAndNoManualSync(){
  val context=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext;TokenVault(context).clear()
  try{ActivityScenario.launch(MainActivity::class.java).use{scenario->scenario.onActivity{a->
   TokenVault(a).save("a".repeat(43))
   MainActivity::class.java.getDeclaredField("data").apply{isAccessible=true}.set(a,org.json.JSONObject("""{"user":{"id":"fixture","name":"Student","email":"student@example.invalid","role":"student"},"studyState":{}}"""))
   MainActivity::class.java.getDeclaredField("tab").apply{isAccessible=true}.set(a,"Account")
   MainActivity::class.java.getDeclaredMethod("draw").apply{isAccessible=true}.invoke(a)
   fun views(v:android.view.View):List<android.view.View> = listOf(v)+(if(v is android.view.ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList())
   val all=views(a.window.decorView);assertFalse(all.filterIsInstance<android.widget.TextView>().any{it.text.toString() in listOf("Sync devices","সিঙ্ক করুন")})
   all.first{it.contentDescription?.toString() in listOf("Reading preferences","পড়ার পছন্দ")}.performClick()
   assertFalse(views(a.window.decorView).any{it is android.webkit.WebView})
   assertTrue(views(a.window.decorView).filterIsInstance<android.widget.TextView>().any{it.text.toString() in listOf("Text size","লেখার আকার")})
   MainActivity::class.java.getDeclaredMethod("openReader",String::class.java,String::class.java).apply{isAccessible=true}.invoke(a,"index.html",null)
   assertFalse(views(a.window.decorView).any{it is android.webkit.WebView})
  }}}finally{TokenVault(context).clear()}
 }
 @Test fun freeStudyReaderWorksWithoutLogin(){
  val context=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext;TokenVault(context).clear()
  ActivityScenario.launch(MainActivity::class.java).use{scenario->
   scenario.onActivity{a->MainActivity::class.java.getDeclaredMethod("openStudy",String::class.java,String::class.java,Boolean::class.javaPrimitiveType).apply{isAccessible=true}.invoke(a,"N5","vocab",false)}
   var count=0
   for(attempt in 0 until 24){val latch=java.util.concurrent.CountDownLatch(1);scenario.onActivity{a->val view=MainActivity::class.java.getDeclaredField("web").apply{isAccessible=true}.get(a) as android.webkit.WebView;view.evaluateJavascript("document.querySelectorAll('article.row').length"){value->count=value.toIntOrNull()?:0;latch.countDown()}};latch.await(2,java.util.concurrent.TimeUnit.SECONDS);if(count==5)break;Thread.sleep(250)}
   assertEquals("Exactly five vocabulary entries should render offline without login",5,count)
  }
 }
 @Test fun secureWindowAndLaunch(){ActivityScenario.launch(MainActivity::class.java).use{scenario->scenario.onActivity{activity->assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0);assertNotNull(activity.findViewById<android.view.View>(android.R.id.content))}}}
 @Test fun accountHasGoogleAndMaskedPassword(){
  ActivityScenario.launch(MainActivity::class.java).use{scenario->scenario.onActivity{a->
   fun views(v:android.view.View):List<android.view.View> = listOf(v)+(if(v is android.view.ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList())
   fun buttons()=views(a.findViewById(android.R.id.content)).filterIsInstance<android.widget.Button>()
   buttons().first{it.text.toString() in listOf("Profile","প্রোফাইল")}.performClick()
   val all=views(a.findViewById(android.R.id.content));val labels=all.filterIsInstance<android.widget.TextView>().map{it.text.toString()}
   assertTrue(labels.any{it.contains("Google")});assertFalse(labels.any{it in listOf("Support","সহায়তা","Privacy policy","গোপনীয়তার নীতি")})
   assertTrue(labels.any{it in listOf("Forgot password?","পাসওয়ার্ড ভুলে গেছেন?")})
   assertFalse(labels.any{it.contains("Resend confirmation")||it.contains("আবার confirmation")||it.contains("Repository")})
   val password=all.filterIsInstance<android.widget.EditText>().first{it.inputType and android.text.InputType.TYPE_MASK_VARIATION==android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD};assertTrue(password.transformationMethod is android.text.method.PasswordTransformationMethod)
  };androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().waitForIdleSync();scenario.onActivity{a->
   val decor=a.window.decorView;val bitmap=android.graphics.Bitmap.createBitmap(decor.width,decor.height,android.graphics.Bitmap.Config.ARGB_8888);decor.draw(android.graphics.Canvas(bitmap));java.io.File(a.filesDir,"auth-preview.png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle()
   fun descendants(v:android.view.View):List<android.view.View> = listOf(v)+(if(v is android.view.ViewGroup)(0 until v.childCount).flatMap{descendants(v.getChildAt(it))}else emptyList())
   descendants(decor).filterIsInstance<android.widget.Button>().first{it.text.toString() in listOf("Don't have an account? Sign Up","অ্যাকাউন্ট নেই? Sign Up")}.performClick()
  };androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().waitForIdleSync();scenario.onActivity{a->
   val decor=a.window.decorView
   assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,a.window.attributes.softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST)
   val bitmap=android.graphics.Bitmap.createBitmap(decor.width,decor.height,android.graphics.Bitmap.Config.ARGB_8888);decor.draw(android.graphics.Canvas(bitmap));java.io.File(a.filesDir,"signup-preview.png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle()
  }}
 }
 @Test fun storeListingScreensAreActualAppViews(){
  val context=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext
  TokenVault(context).clear()
  ActivityScenario.launch(MainActivity::class.java).use{scenario->
   fun capture(file:String){
    androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().waitForIdleSync()
    scenario.onActivity{a->
     assertTrue(a.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
     val decor=a.window.decorView
     val bitmap=android.graphics.Bitmap.createBitmap(decor.width,decor.height,android.graphics.Bitmap.Config.ARGB_8888)
     decor.draw(android.graphics.Canvas(bitmap))
     java.io.File(a.filesDir,file).outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}
     bitmap.recycle()
    }
   }
   capture("library-preview.png")
   scenario.onActivity{a->
    fun views(v:android.view.View):List<android.view.View> = listOf(v)+(if(v is android.view.ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList())
    views(a.window.decorView).filterIsInstance<android.widget.Button>().first{it.contentDescription?.toString() in listOf("Rewards","ক্রেডিট")}.performClick()
   }
   capture("rewards-preview.png")
   scenario.onActivity{a->
    TokenVault(a).save("a".repeat(43))
    MainActivity::class.java.getDeclaredField("data").apply{isAccessible=true}.set(a,org.json.JSONObject("""{"user":{"id":"fixture","name":"Device test student","email":"student@example.invalid","role":"student"},"studyState":{"saved":[],"learned":[]}}"""))
    MainActivity::class.java.getDeclaredField("tab").apply{isAccessible=true}.set(a,"Account")
    MainActivity::class.java.getDeclaredMethod("draw").apply{isAccessible=true}.invoke(a)
   }
   capture("profile-preview.png")
   scenario.onActivity{a->MainActivity::class.java.getDeclaredField("tab").apply{isAccessible=true}.set(a,"ReaderSettings");MainActivity::class.java.getDeclaredMethod("draw").apply{isAccessible=true}.invoke(a)}
   capture("preferences-preview.png")
   TokenVault(context).clear()
  }
 }
 @Test fun secureContentNotVisibleInScreenCapture(){
  ActivityScenario.launch(MainActivity::class.java).use { scenario ->
   scenario.onActivity { a -> assertTrue(a.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0) }
   val automation=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().uiAutomation
   automation.waitForIdle(1000,10000)
   val shot=automation.takeScreenshot() ?: return
   try {
    val points=listOf(0.3f,0.4f,0.5f,0.6f,0.7f)
    for(x in points)for(y in points){val pixel=shot.getPixel((shot.width*x).toInt(),(shot.height*y).toInt());assertTrue("Protected app pixels visible in capture",android.graphics.Color.red(pixel)<8&&android.graphics.Color.green(pixel)<8&&android.graphics.Color.blue(pixel)<8)}
   }finally{shot.recycle()}
  }
 }
 @Test fun signedInAccountCanRenderAndNavigate(){
  val context=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext
  TokenVault(context).clear()
  ActivityScenario.launch(MainActivity::class.java).use{scenario->
   scenario.onActivity{a->
    TokenVault(a).save("a".repeat(43))
    val data=MainActivity::class.java.getDeclaredField("data").apply{isAccessible=true}
    data.set(a,org.json.JSONObject("""{"user":{"id":"00000000-0000-4000-8000-000000000001","name":"Test student","email":"student@example.invalid","role":"student"},"balances":[],"unlocks":[],"tiers":[],"rewards":[],"redemptions":[],"studyState":{}}"""))
    fun views(v:android.view.View):List<android.view.View> = listOf(v)+(if(v is android.view.ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList())
    fun tap(names:List<String>){views(a.findViewById(android.R.id.content)).filterIsInstance<android.widget.Button>().first{it.text.toString() in names}.performClick()}
    repeat(3){
     tap(listOf("Profile","প্রোফাইল"))
     val labels=views(a.findViewById(android.R.id.content)).filterIsInstance<android.widget.TextView>().map{it.text.toString()}
     assertTrue(labels.contains("student@example.invalid"));assertTrue(labels.any{it in listOf("Sign out","লগআউট")})
     tap(listOf("Home","হোম"))
    }
    TokenVault(a).clear()
   }
  }
 }
 @Test fun postgresSnapshotAndResponseErrorsKeepActivityAlive(){
  val context=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext
  TokenVault(context).clear()
  try{ActivityScenario.launch(MainActivity::class.java).use{scenario->scenario.onActivity{a->
   TokenVault(a).save("a".repeat(43))
   val postgresTime="2026-10-29T14:29:09.25706+00:00"
   android.util.Log.i("BooksClockTest","legacyNumericOffsetSupported="+runCatching{java.time.Instant.parse(postgresTime)}.isSuccess)
   assertEquals(1793284149257L,ServerTime.millis(postgresTime))
   val snapshot=org.json.JSONObject("""{"serverTime":"2026-10-29T14:29:09.25706+00:00","user":{"id":"00000000-0000-4000-8000-000000000001","name":"","email":"student@example.invalid","role":"student"},"balances":[{"level":"N5","credits":5}],"unlocks":[{"level":"N5","expires_at":"2099-01-01T00:00:00.000001+00:00"}],"tiers":[],"rewards":[],"redemptions":[],"studyState":{}}""")
   val applySnapshot=MainActivity::class.java.getDeclaredMethod("applySnapshot",org.json.JSONObject::class.java).apply{isAccessible=true}
   applySnapshot.invoke(a,snapshot)
   fun views(v:android.view.View):List<android.view.View> = listOf(v)+(if(v is android.view.ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList())
   fun tap(names:List<String>){views(a.findViewById(android.R.id.content)).filterIsInstance<android.widget.Button>().first{it.text.toString() in names}.performClick()}
   tap(listOf("Profile","প্রোফাইল"))
   val data=MainActivity::class.java.getDeclaredField("data").apply{isAccessible=true}
   val serverAt=MainActivity::class.java.getDeclaredField("serverAt").apply{isAccessible=true}
   val previous=data.get(a);val clock=serverAt.getLong(a)
   val deliver=MainActivity::class.java.getDeclaredMethod("deliver",org.json.JSONObject::class.java,kotlin.jvm.functions.Function1::class.java).apply{isAccessible=true}
   val brokenResponse:(org.json.JSONObject)->Unit={applySnapshot.invoke(a,it)}
   deliver.invoke(a,org.json.JSONObject().put("serverTime","bad-clock"),brokenResponse)
   assertSame(previous,data.get(a));assertEquals(clock,serverAt.getLong(a));assertFalse(a.isFinishing);assertFalse(a.isDestroyed)
   val brokenView:(org.json.JSONObject)->Unit={throw org.json.JSONException("Synthetic response format error")}
   deliver.invoke(a,org.json.JSONObject(),brokenView)
   assertFalse(a.isFinishing)
   tap(listOf("Home","হোম"));tap(listOf("Profile","প্রোফাইল"))
  }}}finally{TokenVault(context).clear()}
 }
}
