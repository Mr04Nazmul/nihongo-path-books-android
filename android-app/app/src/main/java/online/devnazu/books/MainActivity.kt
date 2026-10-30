package online.devnazu.books

import android.app.AlertDialog
import android.graphics.Color
import android.os.*
import android.view.*
import android.webkit.*
import android.widget.*
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.webkit.WebViewAssetLoader
import org.json.*
import java.io.ByteArrayInputStream
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private lateinit var vault: TokenVault
    private lateinit var api: BooksApi
    private lateinit var ads: RewardAds
    private lateinit var root: LinearLayout
    private lateinit var area: LinearLayout
    private val worker=Executors.newFixedThreadPool(3)
    private val syncWorker=Executors.newSingleThreadExecutor()
    private val handler=Handler(Looper.getMainLooper())
    private var authMode="login"
    private var signInEmail=""
    private var authBusy=false
    private val invitationPrefs by lazy {getSharedPreferences("invitation",MODE_PRIVATE)}
    private val oauthVault by lazy {TokenVault(this,"oauth_pending")}
    private var data=JSONObject()
    private var bn=true
    private var tab="Home"
    private var selected="N5"
    private var serverAt=0L
    private var elapsedAt=0L
    private var web: WebView?=null
    private var readerLevel: String?=null
    private var readerExpiry=0L
    private var status: TextView?=null
    private var tts: TextToSpeech?=null
    private val ink=Color.rgb(248,239,231)
    private val paper=Color.rgb(7,13,20)
    private var previewMode=false
    private val compact get()=resources.displayMetrics.widthPixels/resources.displayMetrics.density<320
    private val ticker=object:Runnable { override fun run(){
        if(web!=null && !previewMode && readerLevel!=null && now()>=readerExpiry){closeReader();message(tr("Access expired. Unused credits are safe.","সময় শেষ হয়েছে। অব্যবহৃত ক্রেডিট রাখা হয়েছে।"));refresh()}
        findViewById<TextView>(R.id.access_countdown)?.text=accessText(selected)
        handler.postDelayed(this,1000)
    }}
    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        CrashDiagnostics.install(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        vault=TokenVault(this);api=BooksApi {vault.read()};ads=RewardAds(this)
        tts=TextToSpeech(this) { result -> if(result==TextToSpeech.SUCCESS)tts?.language=Locale.JAPANESE }
        onBackPressedDispatcher.addCallback(this,object:OnBackPressedCallback(true){override fun handleOnBackPressed(){if(web!=null)closeReader() else if(tab!="Home"){tab="Home";draw()}else finish()}})
        if(!getPreferences(MODE_PRIVATE).getBoolean("introduced",false))splash() else draw();handler.post(ticker)
        if(vault.read().isNotEmpty())refresh()
        handleAppIntent(intent)
    }
    override fun onNewIntent(next:android.content.Intent){super.onNewIntent(next);setIntent(next);handleAppIntent(next)}
    private fun handleAppIntent(incoming:android.content.Intent?){
        val uri=incoming?.data?:return
        if(uri.scheme=="nihongopathbooks"&&uri.host=="auth"&&uri.path in listOf("/confirmed","/recovery")){
            incoming.data=null;tab="Account";draw();passwordSupport();return
        }
        if(uri.scheme=="nihongopathbooks"&&uri.host=="join"){
            val code=uri.getQueryParameter("ref")?:""
            if(Regex("^[A-Za-z0-9_-]{3,64}$").matches(code)){invitationPrefs.edit().putString("ref",code).apply();authMode="register";tab="Account";draw();message(tr("Invitation saved · new accounts receive 5 N5 credits","আমন্ত্রণ রাখা হয়েছে · নতুন অ্যাকাউন্টে ৫ N5 ক্রেডিট"))};incoming.data=null;return
        }
        if(uri.scheme=="nihongopathbooks"&&uri.host=="auth"&&uri.path=="/callback"){
            val pending=runCatching{JSONObject(oauthVault.read())}.getOrNull();incoming.data=null
            if(pending==null||pending.optString("flow")!=uri.getQueryParameter("flow")||System.currentTimeMillis()-pending.optLong("started")>600000){message(tr("Sign-in expired. Try Google again.","লগইনের সময় শেষ হয়েছে। আবার Google বেছে নিন।"));return}
            val code=uri.getQueryParameter("code");if(code.isNullOrBlank()){oauthVault.clear();message(tr("Google sign-in was cancelled. Try again.","Google লগইন শেষ হয়নি। আবার চেষ্টা করুন।"));return}
            runAuth({api.request("/auth/exchange","POST",JSONObject().put("code",code).put("verifier",pending.getString("verifier")).put("referralCode",pending.optString("ref")))}){oauthVault.clear();acceptSession(it)};return
        }

    }
    private fun deliver(value:JSONObject,done:(JSONObject)->Unit){
        if(isDestroyed||isFinishing)return
        try{done(value)}catch(e:Exception){handleFailure(e)}
    }
    private fun handleFailure(e:Exception){
        if(isDestroyed||isFinishing)return
        if(e is ApiError&&e.code==401){vault.clear();data=JSONObject();if(web!=null)closeReader();tab="Account";draw()}
        val details=if(e is java.time.DateTimeException||e is org.json.JSONException)tr("Account sync could not finish. Your credits are safe. Please try again.","অ্যাকাউন্ট সিঙ্ক হয়নি। আপনার ক্রেডিট নিরাপদ আছে। আবার চেষ্টা করুন।")else e.message?:tr("Connection failed. Try again.","সংযোগ হয়নি। আবার চেষ্টা করুন।")
        message(details)
    }
    private fun runAuth(action:()->JSONObject,done:(JSONObject)->Unit){
        if(authBusy||isDestroyed||isFinishing)return;authBusy=true;message(tr("Connecting securely…","নিরাপদ সংযোগ হচ্ছে…"))
        worker.execute{try{val result=action();runOnUiThread{authBusy=false;deliver(result,done)}}catch(e:Exception){runOnUiThread{authBusy=false;handleFailure(e)}}}
    }
    private fun acceptSession(result:JSONObject){
        vault.save(result.getString("token"));signInEmail="";invitationPrefs.edit().remove("ref").apply();data=JSONObject();tab="Account";refresh {if(result.optJSONObject("bonus")?.optInt("credited")==5)message(tr("Welcome! 5 N5 invitation credits added.","স্বাগতম! আমন্ত্রণের ৫ N5 ক্রেডিট যোগ হয়েছে।"))}
    }
    private fun googleSignIn(referral:String){
        val random=ByteArray(32);java.security.SecureRandom().nextBytes(random)
        val verifier=android.util.Base64.encodeToString(random,android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP or android.util.Base64.NO_PADDING)
        val challenge=android.util.Base64.encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()),android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP or android.util.Base64.NO_PADDING)
        val flow=UUID.randomUUID().toString();oauthVault.save(JSONObject().put("verifier",verifier).put("flow",flow).put("ref",referral).put("started",System.currentTimeMillis()).toString())
        runAuth({api.request("/auth/google/start","POST",JSONObject().put("challenge",challenge).put("flow",flow))}){result->
            val uri=android.net.Uri.parse(result.getString("url"));if(uri.scheme!="https"||uri.host!=android.net.Uri.parse(BuildConfig.API_BASE).host||uri.path!="/auth/v1/authorize"){message("Sign-in address unavailable");return@runAuth}
            try{startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,uri));message(tr("Choose your Google account, then return here.","Google অ্যাকাউন্ট বেছে নিন, তারপর অ্যাপে ফিরুন।"))}catch(_:android.content.ActivityNotFoundException){message(tr("A browser is needed for secure Google sign-in.","নিরাপদ Google লগইনের জন্য একটি browser লাগবে।"))}
        }
    }

    private val audioPicker=registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.OpenDocument()){uri->
        if(uri!=null)async({contentResolver.openInputStream(uri)?.use{api.uploadAudio(it)}?:throw IllegalStateException("Audio could not be opened")}){result->
            message(tr("Private audio uploaded as a draft","Private audio draft upload হয়েছে"))
            editAdminJson("Review uploaded N5 audio","/admin/review-audio",JSONObject().put("id",result.getString("id")).put("lessonId","mlc-n5-l1-01").put("published",false).put("rights",JSONObject().put("appDistribution",false).put("audioHosting",false).put("advertising",false)).put("review",JSONObject().put("status","pending").put("reviewer","").put("notes","")),"POST")
        }
    }
    private fun editAdminJson(title:String,path:String,initial:JSONObject,method:String="PUT"){
        val input=EditText(this).apply{setText(initial.toString(2));textSize=12f;typeface=android.graphics.Typeface.MONOSPACE;inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE;setHorizontallyScrolling(false);minLines=8;maxLines=18}
        AlertDialog.Builder(this).setTitle(title).setView(input).setNegativeButton(tr("Cancel","বাতিল"),null).setPositiveButton(tr("Save","সংরক্ষণ")){_,_->
            val payload=runCatching{JSONObject(input.text.toString())}.getOrNull();if(payload==null){message("Invalid JSON");return@setPositiveButton}
            async({api.request(path,method,payload)}){message(tr("Saved","সংরক্ষিত হয়েছে"));if(tab=="Admin")draw()}
        }.show()
    }
    private fun administration(){
        add(tr("Administration","অ্যাডমিন ড্যাশবোর্ড"),28f)
        if(data.optJSONObject("user")?.optString("role")!="admin"){add("Administrator sign-in required");return}
        area.addView(button(tr("Upload N5 MP3 · private draft","N5 MP3 upload · private draft")){audioPicker.launch(arrayOf("audio/mpeg"))})
        area.addView(button(tr("New chapter draft","নতুন chapter draft")){editAdminJson("Chapter draft","/admin/chapter",JSONObject().put("id","n5-vocab-chapter-1").put("level","N5").put("kind","vocab").put("title","Lesson 1").put("position",1).put("entries",JSONArray()).put("published",false))})
        async({api.request("/admin/overview")}){overview->if(tab=="Admin"){
            add(overview.optJSONObject("counts")?.toString(2)?:"",14f)
            val levels=overview.optJSONArray("levels")?:JSONArray();for(i in 0 until levels.length()){val level=levels.getJSONObject(i);area.addView(button(level.getString("level")+" · "+if(level.optBoolean("enabled"))"Active" else "Coming soon / disabled"){async({api.request("/admin/level","PATCH",JSONObject().put("level",level.getString("level")).put("enabled",!level.optBoolean("enabled")))}){draw()}}.apply{isEnabled=level.getString("level")!="N1"})}
            add(tr("Reward thresholds and durations","Reward threshold ও সময়"),21f);val tiers=overview.optJSONArray("tiers")?:JSONArray();for(i in 0 until tiers.length()){val tier=tiers.getJSONObject(i);if(tier.getString("level")=="N1")continue;area.addView(button(tier.getString("id")+" · "+tier.getInt("credits")+" credits"){editAdminJson("Reward tier","/admin/tier",tier,"PATCH")})}
            add(tr("Chapter drafts","Chapter drafts"),21f);val chapters=overview.optJSONArray("chapters")?:JSONArray();for(i in 0 until chapters.length()){val chapter=chapters.getJSONObject(i);card{
                addView(text(chapter.optString("title")+" · "+chapter.getString("id")))
                addView(button(tr("Edit draft","Draft edit")){editAdminJson("Chapter draft","/admin/chapter",JSONObject(chapter.toString()).put("published",false))})
                addView(button(tr("Review & publish snapshot","Review করে snapshot publish")){editAdminJson("Manual lexical and rights review","/admin/publish-chapter",JSONObject().put("id",chapter.getString("id")).put("review",JSONObject().put("status","pending").put("reviewer","").put("notes","").put("japaneseChecked",false).put("bengaliChecked",false).put("appDistributionRights",false)),"POST")})
                addView(button(tr("Unpublish snapshot","Snapshot unpublish")){async({api.request("/admin/unpublish-chapter","POST",JSONObject().put("id",chapter.getString("id")))}){draw()}})
            }}
            add(tr("Uploaded audio","Uploaded audio"),21f);val audios=overview.optJSONArray("audio")?:JSONArray();for(i in 0 until audios.length()){val a=audios.getJSONObject(i);area.addView(button(a.getString("id")+" · "+if(a.optBoolean("published"))"Published" else "Draft"){editAdminJson("Audio rights review","/admin/review-audio",JSONObject().put("id",a.getString("id")).put("lessonId",a.optString("lesson_id")).put("published",a.optBoolean("published")).put("rights",a.optJSONObject("rights")?:JSONObject()).put("review",a.optJSONObject("review")?:JSONObject().put("status","pending")),"POST")})}
            for(key in listOf("balances","unlocks","redemptions","revisionHistory","events")){add(key,20f);add(overview.optJSONArray(key)?.toString(2)?:"[]",12f)}
        }}
    }
    private fun tr(en:String,be:String)=if(bn)be else en
    private fun dp(n:Int)=(n*resources.displayMetrics.density).toInt()
    private fun text(value:String,size:Float=16f):TextView=TextView(this).apply{text=value;textSize=size;setTextColor(ink);setPadding(0,dp(6),0,dp(6))}
    private fun button(label:String,action:()->Unit):Button=Button(this).apply{text=label;isAllCaps=false;textSize=15f;setTextColor(Color.WHITE);minHeight=dp(50);background=android.graphics.drawable.GradientDrawable().apply{setColor(Color.rgb(225,112,126));cornerRadius=dp(22).toFloat()};setPadding(dp(14),dp(6),dp(14),dp(6));layoutParams=LinearLayout.LayoutParams(-1,-2).apply{setMargins(0,dp(5),0,dp(5))};setOnClickListener{action()}}
    private fun add(label:String,size:Float=16f){area.addView(text(label,size))}
    private fun card(action:LinearLayout.()->Unit){area.addView(LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(18),dp(14),dp(18),dp(14));background=android.graphics.drawable.GradientDrawable().apply{setColor(Color.rgb(19,28,38));setStroke(dp(1),Color.rgb(43,51,62));cornerRadius=dp(20).toFloat()};layoutParams=LinearLayout.LayoutParams(-1,-2).apply{setMargins(0,dp(8),0,dp(8))};action()})}
    private fun now()=if(serverAt==0L)System.currentTimeMillis() else serverAt+(SystemClock.elapsedRealtime()-elapsedAt)
    private fun expiry(level:String):Long {val rows=data.optJSONArray("unlocks")?:JSONArray();for(i in 0 until rows.length()){val r=rows.getJSONObject(i);if(r.optString("level")==level)return runCatching{ServerTime.millis(r.getString("expires_at"))}.getOrDefault(0)};return 0}
    private fun balance(level:String):Int {val rows=data.optJSONArray("balances")?:JSONArray();for(i in 0 until rows.length()){val r=rows.getJSONObject(i);if(r.optString("level")==level)return r.optInt("credits")};return 0}
    private fun accessText(level:String):String {val left=Access.remaining(expiry(level),now())/1000;return if(left<=0)tr("Locked · ${balance(level)} credits","লক করা · ${balance(level)} ক্রেডিট") else tr("Open · %dh %02dm %02ds remaining","খোলা · বাকি %d ঘণ্টা %02d মিনিট %02d সেকেন্ড").format(left/3600,left/60%60,left%60)}
    private fun message(s:String){status?.text=s;Toast.makeText(this,s,Toast.LENGTH_LONG).show()}
    private fun async(action:()->JSONObject,done:(JSONObject)->Unit){
        if(isDestroyed||isFinishing)return
        worker.execute{try{val value=action();runOnUiThread{deliver(value,done)}}catch(e:Exception){runOnUiThread{handleFailure(e)}}}
    }
    private fun applySnapshot(snapshot:JSONObject){
        val stamp=ServerTime.millis(snapshot.getString("serverTime"))
        require(snapshot.optJSONObject("user")!=null){"Account response unavailable"}
        data=snapshot;serverAt=stamp;elapsedAt=SystemClock.elapsedRealtime()
        if(web==null)draw()
    }
    private fun refresh(after:(()->Unit)?=null){if(vault.read().isEmpty())return;async({api.request("/me")}){applySnapshot(it);after?.invoke()}}
    private fun draw(){
        if(web!=null)return
        if(tab=="Account"&&vault.read().isEmpty()){loginScreen();return}
        root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(paper);setPadding(dp(16),dp(25),dp(16),dp(8))}
        val head=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL;setPadding(0,0,0,dp(8))}
        head.addView(ImageView(this).apply{setImageResource(R.drawable.ic_books);scaleType=ImageView.ScaleType.CENTER_CROP},LinearLayout.LayoutParams(dp(34),dp(34)).apply{setMargins(0,0,dp(10),0)})
        head.addView(text("Nihongo\nPath Books",if(compact)12f else 14f).apply{maxLines=2;ellipsize=android.text.TextUtils.TruncateAt.END;typeface=android.graphics.Typeface.create("serif",android.graphics.Typeface.BOLD)},LinearLayout.LayoutParams(0,-2,1f))
        head.addView(quietButton("♛"){tab="Rewards";draw()}.apply{contentDescription=tr("Rewards","ক্রেডিট");textSize=20f;setTextColor(Color.rgb(231,181,76))},LinearLayout.LayoutParams(dp(30),dp(40)))
        head.addView(quietButton("ⓘ"){tab="About";draw()},LinearLayout.LayoutParams(dp(28),dp(40)))
        head.addView(quietButton(if(bn)"EN" else "বাংলা"){bn=!bn;draw()},LinearLayout.LayoutParams(dp(32),dp(40)));root.addView(head)
        val scroll=ScrollView(this);area=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};scroll.addView(area);root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        val nav=LinearLayout(this).apply{setPadding(0,dp(8),0,0)}
        listOf("Home","Books","Quiz","Progress","Account").forEach { page->
            val label=when(page){"Home"->tr("Home","হোম");"Books"->tr("Books","বই");"Quiz"->tr("Quiz","কুইজ");"Progress"->tr("Progress","অগ্রগতি");else->tr("Profile","প্রোফাইল")}
            val icons=mapOf("Home" to "⌂","Books" to "▣","Quiz" to "◇","Progress" to "▥","Account" to "♙")
            nav.addView(quietButton(label){tab=page;draw()}.apply{contentDescription=label;setCompoundDrawablesWithIntrinsicBounds(null,NavIcon(icons.getValue(page),if(tab==page)Color.rgb(244,158,172) else Color.rgb(154,160,169)),null,null);setTextColor(if(tab==page)Color.rgb(244,158,172) else Color.rgb(154,160,169));textSize=10f;setPadding(0,dp(4),0,0)},LinearLayout.LayoutParams(0,dp(56),1f))
        };root.addView(nav);setContentView(root)
        status=null
        when(tab){"About"->about();"Admin"->administration();"Rewards"->rewards();"Account"->account();"Subjects"->subjectLibrary();"Books"->bookLevels();"Quiz"->quizLibrary();"Progress"->progressScreen();"Bookmarks"->bookmarksScreen();"ReaderSettings"->readerSettings();else->home()}
        if(status==null){status=text("");area.addView(status)}
    }
    private fun splash(){
        val frame=FrameLayout(this)
        val art=ImageView(this).apply{setImageResource(R.drawable.sakura_journey);scaleType=ImageView.ScaleType.CENTER_CROP};frame.addView(art,FrameLayout.LayoutParams(-1,-1))
        val overlay=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER;setPadding(dp(30),dp(60),dp(30),dp(32));background=android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,intArrayOf(0x33050b16,0x11050b16,0xdd050b16.toInt()))}
        overlay.addView(text("日本語の道",34f).apply{gravity=Gravity.CENTER;typeface=android.graphics.Typeface.SERIF})
        overlay.addView(text("Nihongo Path Books",22f).apply{gravity=Gravity.CENTER})
        overlay.addView(Space(this),LinearLayout.LayoutParams(1,0,1f))
        overlay.addView(text(tr("Your complete Japanese learning library","আপনার জাপানি শেখার বইঘর"),19f).apply{gravity=Gravity.CENTER})
        overlay.addView(button("はじめる  →"){getPreferences(MODE_PRIVATE).edit().putBoolean("introduced",true).apply();draw()})
        frame.addView(overlay,FrameLayout.LayoutParams(-1,-1));setContentView(frame)
    }
    private fun quietButton(label:String,action:()->Unit)=button(label,action).apply{background=android.graphics.drawable.ColorDrawable(Color.TRANSPARENT);setTextColor(ink);textSize=12f;minWidth=0;minimumWidth=0;minHeight=0;minimumHeight=0;setPadding(dp(6),0,dp(6),0);layoutParams=LinearLayout.LayoutParams(-2,dp(40))}
    private inner class NavIcon(private val glyph:String,private val tint:Int):android.graphics.drawable.Drawable(){
        override fun draw(canvas:android.graphics.Canvas){val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply{color=tint;textSize=dp(25).toFloat();textAlign=android.graphics.Paint.Align.CENTER};canvas.drawText(glyph,bounds.exactCenterX(),bounds.bottom-dp(3).toFloat(),paint)}
        override fun setAlpha(alpha:Int){};override fun setColorFilter(filter:android.graphics.ColorFilter?){};@Deprecated("Deprecated in Java") override fun getOpacity()=android.graphics.PixelFormat.TRANSLUCENT
        override fun getIntrinsicWidth()=dp(26);override fun getIntrinsicHeight()=dp(29)
    }
    private fun home(){
        area.addView(text("こんにちは！",if(compact)20f else 23f).apply{setPadding(0,dp(2),0,0)});area.addView(text(tr("Let's continue your Japanese journey","চলুন, জাপানি শেখার পথে এগিয়ে যাই"),11f).apply{setPadding(0,dp(3),0,dp(5))})
        val study=data.optJSONObject("studyState")?:JSONObject()
        card{setPadding(dp(14),dp(5),dp(14),dp(5));(layoutParams as LinearLayout.LayoutParams).setMargins(0,dp(5),0,dp(6));addView(text(tr("My progress","আমার অগ্রগতি"),11f).apply{setPadding(0,0,0,0)});val row=LinearLayout(this@MainActivity);row.addView(text(selected,15f).apply{setPadding(0,0,0,0)},LinearLayout.LayoutParams(0,-2,1f));row.addView(text(tr("${study.optJSONArray("learned")?.length()?:0} learned","${study.optJSONArray("learned")?.length()?:0}টি শেখা হয়েছে"),12f));addView(row)}
        val hero=FrameLayout(this)
        hero.addView(ImageView(this).apply{setImageResource(R.drawable.sakura_journey);scaleType=ImageView.ScaleType.CENTER_CROP},FrameLayout.LayoutParams(-1,dp(if(compact)90 else 150)))
        hero.addView(text("毎日の一歩が、未来をつくる。\n"+tr("Small steps today. A brighter future tomorrow.","প্রতিদিন একটু করে, আগামীর পথে।"),13f).apply{setPadding(dp(14),dp(if(compact)42 else 96),dp(14),dp(10));setShadowLayer(8f,0f,2f,Color.BLACK)},FrameLayout.LayoutParams(-1,-1));area.addView(hero)
        val labels=listOf("Vocabulary\n単語","Grammar\n文法","Kanji\n漢字","Books\n教科書");val colors=listOf(0xffb45374.toInt(),0xff286a9b.toInt(),0xff148665.toInt(),0xffad6c35.toInt())
        for(r in 0..1){val row=LinearLayout(this);for(c in 0..1){val i=r*2+c;row.addView(button(labels[i]){if(i==3){tab="Books";draw()}else openStudy(selected,listOf("vocab","grammar","kanji")[i])}.apply{textSize=if(compact)12f else 15f;gravity=Gravity.START or Gravity.CENTER_VERTICAL;setPadding(dp(14),dp(8),dp(8),dp(8));background=android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,intArrayOf(colors[i],0xff101c2c.toInt())).apply{cornerRadius=dp(14).toFloat()}},LinearLayout.LayoutParams(0,dp(if(compact)56 else 72),1f).apply{setMargins(if(c==1)dp(4) else 0,dp(7),if(c==0)dp(4) else 0,0)})};area.addView(row)}
        area.addView(quietButton(tr("Hiragana · Katakana · Numbers →","হিরাগানা · কাতাকানা · সংখ্যা →")){previewMode=false;openReader("basics/index.html",null)})
    }
    private fun openStudy(level:String,kind:String,savedOnly:Boolean=false){selected=level;previewMode=expiry(level)<=now();openReader("study.html?level=$level&section=$kind"+(if(previewMode)"&preview=1" else "")+(if(savedOnly)"&saved=1" else ""),level)}
    private fun bookLevels(){
        add("JLPT Books",24f)
        val filters=LinearLayout(this);listOf("All","N5","N4","N3","N2").forEach{n->filters.addView(quietButton(n){if(n!="All")chooseSubject(n)},LinearLayout.LayoutParams(0,dp(38),1f))};area.addView(filters)
        (Access.levels+"N1").forEachIndexed {i,level->
            val tile=FrameLayout(this).apply{layoutParams=LinearLayout.LayoutParams(-1,dp(94)).apply{setMargins(0,dp(7),0,dp(3))};background=android.graphics.drawable.GradientDrawable().apply{setColor(Color.rgb(28,37,48));cornerRadius=dp(16).toFloat()};clipToOutline=true}
            tile.addView(ImageView(this).apply{setImageResource(R.drawable.sakura_journey);scaleType=ImageView.ScaleType.CENTER_CROP;alpha=if(level=="N1")0.25f else 0.65f},FrameLayout.LayoutParams(-1,-1))
            val hues=intArrayOf(0xffe3a1ba.toInt(),0xff8eabe6.toInt(),0xff8fd5b4.toInt(),0xffe7b67b.toInt(),0xff898b8f.toInt())
            val info=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(18),dp(8),dp(12),dp(8));background=android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.LEFT_RIGHT,intArrayOf(hues[i],0x22334050));addView(text(level,28f).apply{setTextColor(Color.rgb(25,30,36));setPadding(0,0,0,0)});addView(text(listOf("Beginner","Basic","Intermediate","Upper intermediate","Advanced · Coming Soon")[i],12f).apply{setTextColor(Color.rgb(25,30,36));setPadding(0,0,0,0)});if(level!="N1")addView(text(tr("Vocabulary · Grammar · Kanji","শব্দভান্ডার · ব্যাকরণ · কানজি"),11f).apply{setTextColor(Color.rgb(25,30,36));setPadding(0,dp(3),0,0)})}
            tile.addView(info,FrameLayout.LayoutParams(-1,-1));tile.setOnClickListener{chooseSubject(level)};area.addView(tile)
        }
    }
    private fun quizLibrary(){add(tr("Practice a little every day","প্রতিদিন একটু অনুশীলন"),24f);Access.levels.forEach{level->area.addView(button("$level Quiz →"){openStudy(level,"quiz")})}}
    private fun progressScreen(){val study=data.optJSONObject("studyState")?:JSONObject();add(tr("My progress","আমার অগ্রগতি"),26f);card{addView(text(tr("Learned entries","শেখা entry"),14f));addView(text((study.optJSONArray("learned")?.length()?:0).toString(),32f))};card{addView(text(tr("Bookmarks","বুকমার্ক"),14f));addView(text((study.optJSONArray("saved")?.length()?:0).toString(),32f))};add(tr("Sign in to keep your study progress synchronized.","পড়ার অগ্রগতি সংরক্ষণ করতে লগইন করুন।"),13f)}
    private fun chooseSubject(level:String){if(level !in Access.levels){message("N1 · Coming Soon");return};selected=level;tab="Subjects";draw()}
    private fun subjectLibrary(){
        add("←  $selected Books",24f)
        add(tr("First 5 entries in each subject are always free.","প্রতি বিষয়ের প্রথম ৫টি entry সবসময় ফ্রি।"),14f)
        listOf("vocab","grammar","kanji").forEachIndexed {i,kind->card{
            addView(text(listOf("Vocabulary · 単語","Grammar · 文法","Kanji · 漢字")[i],24f))
            addView(button(tr("Read 5 free →","৫টি ফ্রি পড়ুন →")){previewMode=true;openReader("study.html?level=$selected&section=$kind&preview=1",selected)})
            addView(button(tr("Read complete book →","সম্পূর্ণ বই পড়ুন →")){previewMode=false;if(expiry(selected)>now())openReader("study.html?level=$selected&section=$kind",selected)else{tab=if(vault.read().isEmpty())"Account" else "Rewards";draw()}})
        }}
        area.addView(button(tr("Original PDF book →","মূল PDF বই →")){previewMode=false;openPdfBook(selected)})
        if(selected=="N5")area.addView(button(tr("N5 Listening","N5 লিসেনিং")){previewMode=false;openReader("listening.html?level=N5",selected)})
        area.addView(button(tr("Unlock with ads →","বিজ্ঞাপন দেখে খুলুন →")){tab=if(vault.read().isEmpty())"Account" else "Rewards";draw()})
    }
    private fun openPdfBook(level:String){
        if(level=="N1"){message(tr("N1 has text lessons; no owner PDF is supplied.","N1-এর পাঠ টেক্সটে আছে; মালিকের PDF দেওয়া হয়নি।"));return}
        previewMode=false;openReader("pdf-reader.html?level=$level",level)
    }
    private fun rewards(){
        add(tr("Reward Center","ক্রেডিট সেন্টার"),30f);add(tr("Choose a level. Finish an optional ad to earn one verified credit for that level. Redeem only when you choose.","লেভেল বেছে নিন। ইচ্ছামতো একটি বিজ্ঞাপন সম্পূর্ণ দেখে সেই লেভেলের একটি যাচাইকৃত ক্রেডিট পান। নিজের পছন্দে সময় কিনুন।"))
        val picker=Spinner(this);picker.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,Access.levels);picker.setSelection(Access.levels.indexOf(selected));area.addView(picker);picker.onItemSelectedListener=object:AdapterView.OnItemSelectedListener{override fun onNothingSelected(p:AdapterView<*>?){};override fun onItemSelected(p:AdapterView<*>?,v:View?,pos:Int,id:Long){val n=Access.levels[pos];if(n!=selected){selected=n;draw()}}}
        area.addView(text(accessText(selected),20f).apply{id=R.id.access_countdown})
        area.addView(button(tr("Watch one ad · earn 1 $selected credit","একটি বিজ্ঞাপন দেখুন · $selected-এর ১ ক্রেডিট পান")){watchAd()})
        val tiers=data.optJSONArray("tiers")?:JSONArray()
        if(tiers.length()==0){add(tr("Sign in and sync to load available unlock durations.","উপলব্ধ সময় দেখতে লগইন করে সিঙ্ক করুন।"));val costs=Access.thresholds.getValue(selected);listOf("5h","24h","3d","7d").forEachIndexed{i,s->add("$s · ${costs[i]} "+tr("credits","ক্রেডিট"))}}
        for(i in 0 until tiers.length()){val tier=tiers.getJSONObject(i);if(tier.optString("level")!=selected||!tier.optBoolean("enabled"))continue
            val duration=when(tier.getInt("seconds")){18000->tr("5 hours","৫ ঘণ্টা");86400->tr("24 hours","২৪ ঘণ্টা");259200->tr("3 days","৩ দিন");604800->tr("7 days","৭ দিন");else->"${tier.getInt("seconds")/3600} h"}
            card{addView(text("$duration · ${tier.getInt("credits")} "+tr("credits","ক্রেডিট"),21f));addView(button(tr("Redeem & start access","ক্রেডিট দিয়ে পড়া শুরু করুন")){
                AlertDialog.Builder(this@MainActivity).setTitle(tr("Unlock $selected?","$selected খুলবেন? ")).setMessage(tr("Use ${tier.getInt("credits")} credits for $duration. Access starts immediately.","${tier.getInt("credits")} ক্রেডিট দিয়ে $duration পড়ুন। এখনই সময় শুরু হবে।")).setNegativeButton(tr("Cancel","বাতিল"),null).setPositiveButton(tr("Redeem","খুলুন")){_,_->redeem(tier.getString("id"))}.show()
            }.apply{isEnabled=expiry(selected)<=now()&&balance(selected)>=tier.getInt("credits")})}
        }
        area.addView(button(tr("Refresh verification & access","যাচাই ও সময় আপডেট করুন")){refresh()})
        add(tr("Reward history","ক্রেডিটের ইতিহাস"),22f);val history=data.optJSONArray("rewards")?:JSONArray();for(i in 0 until minOf(10,history.length())){val r=history.getJSONObject(i);add("${r.optString("level")} +1 · ${r.optString("created_at")}",13f)}
        add(tr("Unlock history","সময় খোলার ইতিহাস"),22f);val red=data.optJSONArray("redemptions")?:JSONArray();for(i in 0 until minOf(10,red.length())){val r=red.getJSONObject(i);add("${r.optString("level")} −${r.optInt("credits")} · ${r.optString("expires_at")}",13f)}
    }
    private fun redeem(tier:String){
        // Keep request ID on uncertain network results; retries cannot double-spend.
        val prefs=getSharedPreferences("redemptions",MODE_PRIVATE);val key="${data.optJSONObject("user")?.optString("id")}:$tier";val id=prefs.getString(key,null)?:UUID.randomUUID().toString().also{prefs.edit().putString(key,it).apply()}
        async({api.request("/redeem","POST",JSONObject().put("tierId",tier).put("requestId",id))}){prefs.edit().remove(key).apply();message(tr("Access unlocked","পড়ার সময় খোলা হয়েছে"));refresh()}
    }
    private fun watchAd(){
        if(vault.read().isEmpty()){tab="Account";draw();return}
        val level=selected
        async({api.request("/ads/session","POST",JSONObject().put("level",level))}){s->ads.show(s.getString("id"),s.getString("userId"),{message(it)}){
            var verified=false
            val account=s.getString("userId")
            fun checkReward(){
                if(verified||isDestroyed||vault.read().isEmpty()||data.optJSONObject("user")?.optString("id")!=account)return
                refresh {
                    val history=data.optJSONArray("rewards")?:JSONArray()
                    if((0 until history.length()).any{history.getJSONObject(it).optString("ad_session")==s.getString("id")}){
                        verified=true
                        message(tr("Verified · 1 $level credit added","যাচাই সম্পূর্ণ · $level-এর ১ ক্রেডিট যোগ হয়েছে"))
                    }
                }
            }
            checkReward()
            listOf(3000L,10000L,30000L,60000L,120000L).forEach{delay->handler.postDelayed({checkReward()},delay)}
        }}
    }
    private fun field(hint:String,password:Boolean=false)=EditText(this).apply{this.hint=hint;setSingleLine();inputType=if(password)129 else 1;area.addView(this)}
    private fun authInput(parent:LinearLayout,label:String,secret:Boolean=false):EditText{
        parent.addView(text(label,13f));return EditText(this).apply{hint=label;setSingleLine();inputType=if(secret)129 else 1;setTextColor(ink);textSize=16f;setPadding(dp(14),dp(10),dp(14),dp(10));background=android.graphics.drawable.GradientDrawable().apply{setColor(paper);cornerRadius=dp(12).toFloat();setStroke(dp(1),Color.rgb(208,218,211))};layoutParams=LinearLayout.LayoutParams(-1,dp(54)).apply{setMargins(0,0,0,dp(8))};parent.addView(this)}
    }
    private fun passwordSupport(){
        AlertDialog.Builder(this).setTitle(tr("Password help","পাসওয়ার্ডের সহায়তা")).setMessage(tr("Contact support for account recovery. We will check account ownership before changing access. Never send your Gmail password.\n\nHossain Najmul\nWhatsApp: +81 70-9036-6509","অ্যাকাউন্ট ফিরে পেতে Support-এ যোগাযোগ করুন। মালিকানা যাচাই করে সহায়তা করা হবে। Gmail-এর পাসওয়ার্ড পাঠাবেন না।\n\nHossain Najmul\nWhatsApp: +81 70-9036-6509")).setPositiveButton(tr("Close","বন্ধ"),null).show()
    }
    private fun about(){
        add(tr("About Nihongo Path Books","Nihongo Path Books সম্পর্কে"),27f)
        card{addView(text(tr("Your Japanese study companion","আপনার জাপানি শেখার সঙ্গী"),22f));addView(text("N5–N2 · বাংলা + English"));addView(text("Version "+BuildConfig.VERSION_NAME,13f))}
        card{addView(text(tr("Support","সহায়তা"),22f));addView(text("Hossain Najmul\nWhatsApp: +81 70-9036-6509"));addView(text(tr("For login, access or lesson problems, include your app version and level. Never send a password.","লগইন, পড়ার অনুমতি বা পাঠের সমস্যায় অ্যাপের version ও level জানান। পাসওয়ার্ড পাঠাবেন না।")))}
        area.addView(button(tr("Ad privacy choices","বিজ্ঞাপনের গোপনীয়তার পছন্দ")){ads.privacy {}})
        val diagnostic=CrashDiagnostics.summary(this)
        if(diagnostic.isNotEmpty())area.addView(button(tr("Copy crash details for support","সহায়তার জন্য crash তথ্য কপি করুন")){
            (getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager).setPrimaryClip(android.content.ClipData.newPlainText("Nihongo crash details",diagnostic))
            message(tr("Diagnostic details copied. You can share them with support.","সমস্যার তথ্য কপি হয়েছে। চাইলে Support-এ পাঠাতে পারবেন।"))
        })
    }
    private fun account(){
        if(vault.read().isEmpty()){loginScreen();return}
        run {
            val profile=data.optJSONObject("user")?:JSONObject()
            add(tr("My profile","আমার প্রোফাইল"),27f)
            card{
                val line=LinearLayout(this@MainActivity).apply{gravity=Gravity.CENTER_VERTICAL}
                line.addView(text("◉",36f).apply{setTextColor(android.graphics.Color.rgb(238,155,171))},LinearLayout.LayoutParams(dp(52),-2))
                val identity=LinearLayout(this@MainActivity).apply{orientation=LinearLayout.VERTICAL;addView(text(profile.optString("name").ifBlank{tr("Japanese learner","জাপানি শিক্ষার্থী")},20f));addView(text(profile.optString("email"),12f))}
                line.addView(identity,LinearLayout.LayoutParams(0,-2,1f));line.addView(quietButton("✎"){editProfileName()});addView(line)
            }
            card{
                background=android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,intArrayOf(0xff653d60.toInt(),0xff182735.toInt())).apply{cornerRadius=dp(22).toFloat()}
                addView(text(tr("A little gift for a friend","বন্ধুর জন্য ছোট্ট উপহার"),22f))
                addView(text(tr("Invite a friend. A new account receives 5 N5 credits once.","আমন্ত্রণের কোডে নতুন অ্যাকাউন্ট খুললে বন্ধু একবার ৫ N5 ক্রেডিট পাবেন।"),13f))
                addView(button(tr("Share my invitation  ↗","আমার আমন্ত্রণ শেয়ার করুন  ↗")){shareInvitation()})
            }
            card{
                addView(text(tr("YOUR STUDY SPACE","আপনার পড়ার জায়গা"),11f).apply{setTextColor(Color.rgb(171,177,187))})
                addView(profileRow("♡",tr("Bookmarks & progress","বুকমার্ক ও অগ্রগতি"),tr("Return to the words you saved","সংরক্ষিত শব্দ ও পড়ার অগ্রগতি")){tab="Bookmarks";draw()})
                addView(profileRow("⚙",tr("Reading preferences","পড়ার পছন্দ"),tr("Text size and pronunciation speed","লেখার আকার ও উচ্চারণের গতি")){tab="ReaderSettings";draw()})
            }
            card{
                addView(text(tr("ACCOUNT","অ্যাকাউন্ট"),11f).apply{setTextColor(Color.rgb(171,177,187))})
                addView(quietButton(tr("Sign out","লগআউট")){signOut(false)})
                addView(quietButton(tr("Security & account data","নিরাপত্তা ও অ্যাকাউন্টের তথ্য")){accountSecurity()})
                if(profile.optString("role")=="admin")addView(quietButton(tr("Admin Dashboard","অ্যাডমিন ড্যাশবোর্ড")){tab="Admin";draw()})
            }
        }
    }
    private fun profileRow(icon:String,title:String,subtitle:String,action:()->Unit):LinearLayout=LinearLayout(this).apply{
        gravity=Gravity.CENTER_VERTICAL;setPadding(0,dp(10),0,dp(10));addView(text(icon,24f).apply{setTextColor(Color.rgb(240,160,176))},LinearLayout.LayoutParams(dp(40),-2))
        addView(LinearLayout(this@MainActivity).apply{orientation=LinearLayout.VERTICAL;addView(text(title,16f).apply{setPadding(0,0,0,dp(3))});addView(text(subtitle,11f).apply{setPadding(0,0,0,0);setTextColor(Color.rgb(166,174,185))})},LinearLayout.LayoutParams(0,-2,1f));addView(text("›",25f));isClickable=true;isFocusable=true;contentDescription=title;setOnClickListener{action()}
    }
    private fun editProfileName(){val input=EditText(this).apply{setSingleLine();setText(data.optJSONObject("user")?.optString("name")?:"")};AlertDialog.Builder(this).setTitle(tr("Your name","আপনার নাম")).setView(input).setNegativeButton(tr("Cancel","বাতিল"),null).setPositiveButton(tr("Save","রাখুন")){_,_->async({api.request("/profile","PATCH",JSONObject().put("name",input.text.toString().trim()))}){refresh()}}.show()}
    private fun shareInvitation(){async({api.request("/referrals")}){r->val code=r.getString("code");val link="nihongopathbooks://join?ref="+android.net.Uri.encode(code);AlertDialog.Builder(this).setTitle(tr("Your invitation code","আপনার আমন্ত্রণ কোড")).setMessage(code+"\n\n"+tr("A new account receives 5 N5 credits with this code.","এই কোডে নতুন অ্যাকাউন্ট খুললে একবার ৫ N5 ক্রেডিট পাওয়া যাবে।")).setNegativeButton(tr("Close","বন্ধ"),null).setPositiveButton(tr("Share","শেয়ার")){_,_->startActivity(android.content.Intent.createChooser(android.content.Intent(android.content.Intent.ACTION_SEND).apply{type="text/plain";putExtra(android.content.Intent.EXTRA_TEXT,"Nihongo Path Books · 5 free N5 credits\n"+link+"\nCode: "+code)},tr("Invite a friend","বন্ধুকে আমন্ত্রণ")))}.show()}}
    private fun signOut(all:Boolean){async({api.request(if(all)"/auth/logout-all" else "/auth/logout","POST")}){vault.clear();WebStorage.getInstance().deleteAllData();data=JSONObject();tab="Home";draw()}}
    private fun accountSecurity(){AlertDialog.Builder(this).setTitle(tr("Account security","অ্যাকাউন্টের নিরাপত্তা")).setItems(arrayOf(tr("Sign out all devices","সব ডিভাইস থেকে লগআউট"),tr("Delete Nihongo app data","Nihongo অ্যাপের তথ্য মুছুন"))){_,i->if(i==0)signOut(true)else AlertDialog.Builder(this).setTitle(tr("Delete app data permanently?","অ্যাপের তথ্য স্থায়ীভাবে মুছবেন? ")).setMessage(tr("Credits, progress and access will be removed. Your shared sign-in identity remains.","ক্রেডিট, পড়ার অগ্রগতি ও অনুমতি মুছে যাবে। Shared login থাকবে।")).setNegativeButton(tr("Cancel","বাতিল"),null).setPositiveButton(tr("Delete","মুছুন")){_,_->async({api.request("/account","DELETE")}){vault.clear();WebStorage.getInstance().deleteAllData();data=JSONObject();tab="Home";draw()}}.show()}.show()}
    private fun bookmarksScreen(){add(tr("Bookmarks & progress","বুকমার্ক ও অগ্রগতি"),25f);val study=data.optJSONObject("studyState")?:JSONObject();add(tr("${study.optJSONArray("saved")?.length()?:0} bookmarks · ${study.optJSONArray("learned")?.length()?:0} learned","${study.optJSONArray("saved")?.length()?:0}টি বুকমার্ক · ${study.optJSONArray("learned")?.length()?:0}টি শেখা হয়েছে"),14f);Access.levels.forEach{level->card{addView(text(level,22f));listOf("vocab","grammar","kanji").forEachIndexed{i,kind->addView(quietButton(listOf(tr("Saved vocabulary","সংরক্ষিত শব্দ"),tr("Saved grammar","সংরক্ষিত ব্যাকরণ"),tr("Saved kanji","সংরক্ষিত কানজি"))[i]+"  →"){openStudy(level,kind,true)})}}}}
    private fun readerSettings(){add(tr("Reading preferences","পড়ার পছন্দ"),25f);card{addView(text(tr("Text size","লেখার আকার"),20f));listOf(100,115,130).forEachIndexed{i,size->addView(button(listOf(tr("Standard","সাধারণ"),tr("Large","বড়"),tr("Extra large","আরও বড়"))[i]+if(getPreferences(MODE_PRIVATE).getInt("reader_zoom",100)==size)"  ✓" else ""){getPreferences(MODE_PRIVATE).edit().putInt("reader_zoom",size).apply();draw()})}};card{addView(text(tr("Pronunciation speed","উচ্চারণের গতি"),20f));listOf(0.75f,1f).forEachIndexed{i,speed->addView(quietButton(listOf(tr("Slow and clear","ধীরে ও স্পষ্ট"),tr("Natural speed","স্বাভাবিক গতি"))[i]){getPreferences(MODE_PRIVATE).edit().putFloat("speech_rate",speed).apply();tts?.setSpeechRate(speed);message(tr("Saved","সংরক্ষিত"))})}}}
    private fun loginScreen(){
        val register=authMode=="register"
        root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;background=LoginBlossoms();setPadding(dp(24),dp(24),dp(24),dp(20))}
        root.addView(quietButton("←"){tab="Home";draw()}.apply{contentDescription=tr("Back to home","হোমে ফিরুন")},LinearLayout.LayoutParams(dp(38),dp(32)))
        val scroll=ScrollView(this).apply{isFillViewport=true};area=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER_HORIZONTAL};scroll.addView(area);root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f));status=null
        area.addView(ImageView(this).apply{setImageResource(R.drawable.login_emblem)},LinearLayout.LayoutParams(dp(82),dp(82)).apply{gravity=Gravity.CENTER_HORIZONTAL;setMargins(0,dp(5),0,dp(8))})
        area.addView(text("Nihongo\nPath Books",28f).apply{gravity=Gravity.CENTER;typeface=android.graphics.Typeface.create("serif",android.graphics.Typeface.BOLD);setPadding(0,0,0,0)})
        area.addView(text(tr("Learn Japanese Step by Step","ধাপে ধাপে জাপানি শিখুন"),12f).apply{gravity=Gravity.CENTER;setTextColor(Color.rgb(185,181,176));setPadding(0,dp(9),0,dp(22))})
        val form=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};area.addView(form,LinearLayout.LayoutParams(-1,-2))
        val email=loginField(form,tr("Email address","ইমেইল ঠিকানা"),"♙").apply{inputType=33;setText(signInEmail);if(Build.VERSION.SDK_INT>=26)setAutofillHints("emailAddress")}
        val password=loginField(form,tr("Password","পাসওয়ার্ড"),"♧",true).apply{transformationMethod=android.text.method.PasswordTransformationMethod.getInstance();if(Build.VERSION.SDK_INT>=26)setAutofillHints(if(register)"newPassword" else "password")}
        val name=if(register)loginField(form,tr("Your name","আপনার নাম"),"♙")else null
        val code=if(register||!invitationPrefs.getString("ref","").isNullOrBlank())loginField(form,tr("Invitation code · optional","আমন্ত্রণ কোড · ঐচ্ছিক"),"↗").apply{setText(invitationPrefs.getString("ref",""))}else null
        form.addView(button(if(register)tr("Create account","অ্যাকাউন্ট খুলুন")else tr("Login","লগইন")){
            val mail=email.text.toString().trim();val pass=password.text.toString();val ref=code?.text?.toString()?.trim()?:invitationPrefs.getString("ref","").orEmpty()
            if(!android.util.Patterns.EMAIL_ADDRESS.matcher(mail).matches()){message(tr("Enter a valid email address.","সঠিক ইমেইল ঠিকানা দিন।"));return@button}
            if(pass.isEmpty()||(register&&pass.length<10)){message(tr("New accounts need at least 10 password characters.","নতুন অ্যাকাউন্টের পাসওয়ার্ডে অন্তত ১০ অক্ষর দিন।"));return@button}
            invitationPrefs.edit().putString("ref",ref).apply()
            runAuth({api.request(if(register)"/auth/register"else "/auth/login","POST",JSONObject().put("email",mail).put("password",pass).put("name",name?.text?.toString()?:"").put("referralCode",ref))}){result->password.text.clear();signInEmail=mail;acceptSession(result)}
        }.apply{layoutParams=LinearLayout.LayoutParams(-1,dp(46)).apply{setMargins(0,dp(8),0,dp(9))};textSize=14f})
        if(!register)form.addView(quietButton(tr("Forgot password?","পাসওয়ার্ড ভুলে গেছেন?")){passwordSupport()}.apply{setTextColor(Color.rgb(242,175,182));gravity=Gravity.CENTER},LinearLayout.LayoutParams(-1,dp(36)))
        val separator=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL;setPadding(0,dp(12),0,dp(12))};for(i in 0..2){if(i==1)separator.addView(text("OR",11f).apply{gravity=Gravity.CENTER},LinearLayout.LayoutParams(dp(42),-2))else separator.addView(android.view.View(this).apply{setBackgroundColor(Color.rgb(50,54,62))},LinearLayout.LayoutParams(0,dp(1),1f))};form.addView(separator)
        form.addView(button(tr("G   Continue with Google","G   Google দিয়ে চালিয়ে যান")){googleSignIn(code?.text?.toString()?.trim()?:invitationPrefs.getString("ref","").orEmpty())}.apply{setTextColor(Color.rgb(22,25,30));textSize=13f;background=android.graphics.drawable.GradientDrawable().apply{setColor(Color.rgb(255,251,244));cornerRadius=dp(23).toFloat()};layoutParams=LinearLayout.LayoutParams(-1,dp(46)).apply{setMargins(0,dp(3),0,dp(15))}})
        form.addView(quietButton(if(register)tr("Already registered? Sign in","অ্যাকাউন্ট আছে? লগইন করুন")else tr("Don't have an account? Sign Up","অ্যাকাউন্ট নেই? Sign Up")){authMode=if(register)"login"else "register";draw()}.apply{setTextColor(Color.rgb(242,175,182));gravity=Gravity.CENTER},LinearLayout.LayoutParams(-1,dp(42)))
        if(register)form.addView(text(tr("Valid invitations give a new account 5 N5 credits once.","সঠিক আমন্ত্রণ কোডে নতুন অ্যাকাউন্ট একবার ৫ N5 ক্রেডিট পাবে।"),11f))
        status=text("",12f).apply{gravity=Gravity.CENTER};form.addView(status);setContentView(root)
    }
    private fun loginField(parent:LinearLayout,label:String,icon:String,secret:Boolean=false):EditText{
        val row=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL;setPadding(dp(12),0,dp(10),0);background=android.graphics.drawable.GradientDrawable().apply{setColor(0x33151d29);setStroke(dp(1),Color.rgb(65,70,80));cornerRadius=dp(11).toFloat()};layoutParams=LinearLayout.LayoutParams(-1,dp(46)).apply{setMargins(0,0,0,dp(10))}}
        row.addView(text(icon,20f),LinearLayout.LayoutParams(dp(29),-2));val input=EditText(this).apply{hint=label;contentDescription=label;setSingleLine();inputType=if(secret)129 else 1;setTextColor(ink);setHintTextColor(Color.rgb(176,178,183));textSize=13f;background=null;setPadding(0,0,0,0)};row.addView(input,LinearLayout.LayoutParams(0,-1,1f))
        if(secret)row.addView(quietButton("◉"){val show=input.transformationMethod!=null;input.transformationMethod=if(show)null else android.text.method.PasswordTransformationMethod.getInstance();input.setSelection(input.text.length)}.apply{contentDescription=tr("Show or hide password","পাসওয়ার্ড দেখুন বা লুকান")},LinearLayout.LayoutParams(dp(30),-1));parent.addView(row);return input
    }
    private inner class LoginBlossoms:android.graphics.drawable.Drawable(){
        override fun draw(c:android.graphics.Canvas){c.drawColor(Color.rgb(5,10,17));val p=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);val w=bounds.width().toFloat();val density=resources.displayMetrics.density
            fun flower(x:Float,y:Float,r:Float){c.save();c.translate(x,y);p.color=Color.rgb(224,115,142);for(i in 0..4){c.save();c.rotate(i*72f);c.drawOval(-r*.34f,-r,r*.34f,0f,p);c.restore()};p.color=Color.rgb(248,189,193);c.drawCircle(0f,0f,r*.16f,p);c.restore()}
            listOf(floatArrayOf(10f,18f,11f),floatArrayOf(40f,5f,7f),floatArrayOf(25f,69f,7f),floatArrayOf(8f,115f,10f)).forEach{flower(it[0]*density,it[1]*density,it[2]*density)}
            listOf(floatArrayOf(10f,45f,9f),floatArrayOf(36f,20f,7f),floatArrayOf(14f,112f,8f),floatArrayOf(28f,164f,6f)).forEach{flower(w-it[0]*density,it[1]*density,it[2]*density)}
        };override fun setAlpha(alpha:Int){};override fun setColorFilter(filter:android.graphics.ColorFilter?){};@Deprecated("Deprecated in Java")override fun getOpacity()=android.graphics.PixelFormat.OPAQUE
    }
    @Suppress("SetJavaScriptEnabled")
    private fun openReader(route:String,level:String?){
        if(!Access.readerScreen(route)){tab="Books";draw();return}
        if(level=="N1"||(route.startsWith("listening")&&level!="N5")){message("Unavailable in this release");return}
        if(!previewMode&&level!=null&&expiry(level)<=now()){tab="Rewards";draw();return}
        readerLevel=level;readerExpiry=level?.let{expiry(it)}?:Long.MAX_VALUE
        val container=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(0,dp(28),0,0);setBackgroundColor(paper)}
        container.addView(quietButton(tr("← Library","← বইঘর")){closeReader()},LinearLayout.LayoutParams(-1,dp(44)))
        val loader=WebViewAssetLoader.Builder().addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(this)).build()
        val view=WebView(this);web=view
        view.settings.apply{javaScriptEnabled=true;textZoom=getPreferences(MODE_PRIVATE).getInt("reader_zoom",100);domStorageEnabled=true;allowFileAccess=false;allowContentAccess=false;cacheMode=WebSettings.LOAD_NO_CACHE;setSupportMultipleWindows(false);mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW;mediaPlaybackRequiresUserGesture=true}
        WebView.setWebContentsDebuggingEnabled(false)
        view.addJavascriptInterface(object{
            @JavascriptInterface fun saveProgress(value:String){
                if(vault.read().isNotEmpty() && value.length<150000){
                    val owner=data.optJSONObject("user")?.optString("id")
                    runOnUiThread { if(data.optJSONObject("user")?.optString("id")==owner)data.put("studyState",JSONObject(value)) }
                    val credential=vault.read()
                    syncWorker.execute{if(credential==vault.read())runCatching{api.request("/study-state","PUT",JSONObject().put("state",JSONObject(value)))}}
                }
            }
            @JavascriptInterface fun speak(text:String){runOnUiThread{tts?.setSpeechRate(getPreferences(MODE_PRIVATE).getFloat("speech_rate",1f));tts?.speak(text.take(2000),TextToSpeech.QUEUE_FLUSH,null,"study")}}
            @JavascriptInterface fun stopSpeech(){tts?.stop()}
            @JavascriptInterface fun backToLibrary(){runOnUiThread{closeReader();tab="Books";draw()}}
            @JavascriptInterface fun unlock(){runOnUiThread{closeReader();tab=if(vault.read().isEmpty())"Account" else "Rewards";draw()}}
        },"StudyNative")
        view.webViewClient=object:WebViewClient(){
            override fun shouldOverrideUrlLoading(v:WebView,r:WebResourceRequest):Boolean {
                if(!Access.internal(r.url.toString())){message(tr("This link is outside the study library.","এই লিংকটি স্টাডি লাইব্রেরির বাইরে।"));return true}
                val relative=r.url.path.orEmpty().removePrefix("/assets/reader/")
                if(relative.endsWith(".html")&&!Access.readerScreen(relative)){closeReader();tab="Books";draw();return true}
                if(relative=="listening.html"&&r.url.getQueryParameter("level")!="N5")return true
                return false
            }
            override fun shouldInterceptRequest(v:WebView,r:WebResourceRequest):WebResourceResponse {
                fun denied(code:Int=403)=WebResourceResponse("text/plain","UTF-8",code,if(code==403)"Forbidden" else "Unavailable",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream("Access unavailable. Return to Reward Center and refresh.".toByteArray()))
                if(!Access.internal(r.url.toString()))return denied()
                val path=r.url.path!!.removePrefix("/assets/reader/")
                if(path.endsWith(".html")&&!Access.readerScreen(path))return denied()
                if(Regex("(?:^|/)(?:lessons-|owner-|listening-|jlpt-)?n1(?:[./-])").containsMatchIn(path)||Regex("^data/listening-n[2-4]\\.json$").matches(path)||Regex("^audio/(?:listening/)?n[1-4]/").containsMatchIn(path))return denied()
                val protected=path.startsWith("pdfs/")||path.startsWith("audio/")||Regex("^data/(?:lessons-|owner-|listening-)?n[1-5]\\.json$").matches(path)||path=="data/extra.json"
                if(protected&&previewMode){
                    if(!Regex("^data/lessons-n[2-5]\\.json$").matches(path))return denied()
                    return try{WebResourceResponse("application/json","UTF-8",assets.open("reader/previews/"+path.substringAfterLast('/')))}catch(_:Exception){denied()}
                }
                if(protected){return try{val (type,bytes)=api.content(path);WebResourceResponse(type.substringBefore(';'),null,200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream(bytes))}catch(_:Exception){denied(503)}}
                if(path.endsWith(".mjs"))return try{WebResourceResponse("text/javascript","UTF-8",assets.open("reader/"+path))}catch(_:Exception){denied()}
                return loader.shouldInterceptRequest(r.url)?:denied()
            }
            override fun onPageFinished(v:WebView,url:String){
                if(url.contains("/study.html")||url.contains("/pdf-reader.html")){
                    val restored=data.optJSONObject("studyState")
                    if(restored!=null&&restored.length()>0)v.evaluateJavascript("Object.assign(state,JSON.parse(${JSONObject.quote(restored.toString())}));state.saved=state.saved||[];localStorage.setItem('nihongo-path',JSON.stringify(state));if(typeof data!=='undefined'&&data.vocab&&typeof render==='function')render();",null)
                    return
                }
            }
        }
        container.addView(view,LinearLayout.LayoutParams(-1,0,1f));setContentView(container);view.loadUrl("https://appassets.androidplatform.net/assets/reader/$route")
    }
    private fun closeReader(){web?.apply{stopLoading();loadUrl("about:blank");removeJavascriptInterface("StudyNative");clearCache(true);destroy()};web=null;readerLevel=null;previewMode=false;tts?.stop();draw()}
    override fun onPause(){web?.onPause();tts?.stop();super.onPause()}
    override fun onResume(){super.onResume();web?.onResume();if(web==null&&vault.read().isNotEmpty())refresh();if(web!=null&&!previewMode&&readerLevel!=null)refresh{if(expiry(readerLevel!!)<=now())closeReader()}}
    override fun onDestroy(){handler.removeCallbacksAndMessages(null);web?.destroy();tts?.shutdown();worker.shutdownNow();syncWorker.shutdownNow();super.onDestroy()}
}
