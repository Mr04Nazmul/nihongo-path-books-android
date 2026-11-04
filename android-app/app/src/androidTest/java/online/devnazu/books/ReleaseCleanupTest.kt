package online.devnazu.books
import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
@RunWith(AndroidJUnit4::class)
class ReleaseCleanupTest {
 private fun views(v:View):List<View> = listOf(v)+(if(v is ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList())
 @Test fun removedSectionsCannotOpenAndBrandingLoads(){
  val context=InstrumentationRegistry.getInstrumentation().targetContext
  context.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putBoolean("introduced",true).commit();TokenVault(context).clear()
  assertEquals("Nihongo Path",context.applicationInfo.loadLabel(context.packageManager).toString())
  assertNotNull(context.getDrawable(R.drawable.nihongo_logo))
  assertFalse(Access.readerScreen("listening.html?level=N5"))
  ActivityScenario.launch(MainActivity::class.java).use{scenario->scenario.onActivity{a->
   val tab=MainActivity::class.java.getDeclaredField("tab").apply{isAccessible=true}
   val draw=MainActivity::class.java.getDeclaredMethod("draw").apply{isAccessible=true}
   for(screen in listOf("Home","Books","Subjects","About")){
    tab.set(a,screen);draw.invoke(a)
    val labels=views(a.window.decorView).filterIsInstance<TextView>().map{it.text.toString()}
    assertFalse(labels.toString(),labels.any{it.contains("Listening",true)||it.contains("লিসেনিং")||it.contains("Mock Test",true)||it.contains("মক টেস্ট")})
   }
   MainActivity::class.java.getDeclaredMethod("openReader",String::class.java,String::class.java).apply{isAccessible=true}.invoke(a,"listening.html?level=N5","N5")
   assertNull(MainActivity::class.java.getDeclaredField("web").apply{isAccessible=true}.get(a))
  }}
 }
}
