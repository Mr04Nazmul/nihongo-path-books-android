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
    private fun button(label:String,action:()->Unit):Button=Button(this).apply{text=label;isAllCaps=false;textSize=15f;setTextColor(Color.WHITE);minHeight=dp(50);backgroundTintList=android.content.res.ColorStateList.valueOf(Color.rgb(225,112,126));setPadding(dp(14),dp(6),dp(14),dp(6));layoutParams=LinearLayout.LayoutParams(-1,-2).apply{setMargins(0,dp(5),0,dp(5))};setOnClickListener{action()}}
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
        root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(paper);setPadding(dp(18),dp(30),dp(18),dp(12))}
        val head=LinearLayout(this);head.gravity=Gravity.CENTER_VERTICAL;head.addView(text("NIHONGO PATH\nBOOKS",16f),LinearLayout.LayoutParams(0,-2,1f));head.addView(button(tr("About","তথ্য")){tab="About";draw()},LinearLayout.LayoutParams(-2,-2));head.addView(button(if(bn)"EN" else "বাংলা"){bn=!bn;draw()},LinearLayout.LayoutParams(-2,-2));root.addView(head)
        val scroll=ScrollView(this);area=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};scroll.addView(area);root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        val nav=LinearLayout(this);listOf("Home","Rewards","Account").forEach { page->nav.addView(button(when(page){"Home"->tr("Library","বইঘর");"Rewards"->tr("Rewards","ক্রেডিট");else->tr("Account","অ্যাকাউন্ট")}){tab=page;draw()},LinearLayout.LayoutParams(0,-2,1f)) };root.addView(nav);setContentView(root)
        status=null
        when(tab){"About"->about();"Admin"->administration();"Rewards"->rewards();"Account"->account();"Books"->subjectLibrary();else->home()}
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
    private fun home(){
        add("こんにちは！",28f);add(tr("Let's continue your Japanese journey","চলুন, জাপানি শেখার পথে এগিয়ে যাই"),15f)
        val hero=FrameLayout(this)
        hero.addView(ImageView(this).apply{setImageResource(R.drawable.sakura_journey);scaleType=ImageView.ScaleType.CENTER_CROP},FrameLayout.LayoutParams(-1,dp(190)))
        hero.addView(text("毎日の一歩が、未来をつくる。\n"+tr("Small steps today. A brighter future tomorrow.","আজকের ছোট পদক্ষেপ, আগামীর সুন্দর ভবিষ্যৎ।"),18f).apply{setPadding(dp(16),dp(105),dp(16),dp(12));setShadowLayer(8f,0f,2f,Color.BLACK)},FrameLayout.LayoutParams(-1,-1));area.addView(hero)
        card {addView(text(tr("Start here · Always free","শুরু এখানেই · সবসময় ফ্রি"),22f));addView(text(tr("Hiragana · Katakana · Japanese numbers","হিরাগানা · কাতাকানা · জাপানি সংখ্যা")));addView(button(tr("Open basics →","প্রাথমিক পাঠ খুলুন →")){openReader("basics/index.html",null)})}
        add("JLPT Books",26f)
        Access.levels.forEachIndexed { i,level->card {
            background=android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.LEFT_RIGHT,intArrayOf(intArrayOf(0xff673c57.toInt(),0xff304e78.toInt(),0xff235c4f.toInt(),0xff77512f.toInt())[i],0xff101922.toInt())).apply{cornerRadius=dp(20).toFloat()}
            addView(text(level+"  ·  "+listOf("Beginner","Basic","Intermediate","Upper intermediate")[i],26f));addView(text(tr("5 vocabulary · 5 grammar · 5 kanji free","৫টি vocabulary · ৫টি grammar · ৫টি kanji ফ্রি"),14f));addView(text(accessText(level),13f));addView(button(tr("Explore books →","বই দেখুন →")){chooseSubject(level)})
        }}
        card{addView(text("N1 · Coming Soon",26f));addView(text(tr("Locked","লক করা")))}
    }
    private fun chooseSubject(level:String){
        if(level !in Access.levels){message("N1 · Coming Soon");return};selected=level;tab="Books";draw()
    }
    private fun subjectLibrary(){
        add("←  $selected Books",28f)
        add(tr("First 5 entries in each subject are always free.","প্রতি বিষয়ের প্রথম ৫টি entry সবসময় ফ্রি।"),14f)
        listOf("vocab","grammar","kanji").forEachIndexed {i,kind->card{
            addView(text(listOf("Vocabulary · 単語","Grammar · 文法","Kanji · 漢字")[i],24f))
            addView(button(tr("Read 5 free →","৫টি ফ্রি পড়ুন →")){previewMode=true;openReader("study.html?level=$selected&section=$kind&preview=1",selected)})
            addView(button(tr("Read complete book →","সম্পূর্ণ বই পড়ুন →")){previewMode=false;if(expiry(selected)>now())openReader("study.html?level=$selected&section=$kind",selected)else{tab=if(vault.read().isEmpty())"Account" else "Rewards";draw()}})
        }}
        if(selected=="N5")area.addView(button(tr("N5 Listening","N5 লিসেনিং")){previewMode=false;openReader("listening.html?level=N5",selected)})
        area.addView(button(tr("Unlock with ads →","বিজ্ঞাপন দেখে খুলুন →")){tab=if(vault.read().isEmpty())"Account" else "Rewards";draw()})
    }
    private fun openPdfBook(level:String){
        if(level=="N1"){message(tr("N1 has text lessons; no owner PDF is supplied.","N1-এর পাঠ টেক্সটে আছে; মালিকের PDF দেওয়া হয়নি।"));return}
        openReader("${level.lowercase()}.html?section=vocab&edition=pdf",level)
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
        if(vault.read().isEmpty()){
            val register=authMode=="register"
            area.addView(ImageView(this).apply{setImageResource(R.drawable.ic_books);scaleType=ImageView.ScaleType.CENTER_CROP},LinearLayout.LayoutParams(dp(92),dp(92)).apply{gravity=Gravity.CENTER_HORIZONTAL;setMargins(0,dp(16),0,dp(12))})
            add("Nihongo\nPath Books",34f)
            add(tr("Learn Japanese Step by Step","ধাপে ধাপে জাপানি শিখুন"),15f)
            add(tr("Keep your books, progress and credits together.","বই, পড়ার অগ্রগতি ও ক্রেডিট একসঙ্গে রাখুন।"),15f)
            card{
                addView(text(if(register)tr("Create your account","আপনার অ্যাকাউন্ট খুলুন") else tr("Welcome back","আবার স্বাগতম"),25f))
                status=text(tr("Create an account and start reading.","অ্যাকাউন্ট খুলে সরাসরি পড়া শুরু করুন।"),14f);addView(status)
                val form=this
                var invitationInput:EditText?=null
                addView(button(tr("Continue with Google","Google দিয়ে চালিয়ে যান")){googleSignIn(invitationInput?.text?.toString()?.trim()?:"")}.apply{setTextColor(ink);backgroundTintList=null;background=android.graphics.drawable.GradientDrawable().apply{setColor(Color.rgb(30,40,53));cornerRadius=dp(12).toFloat();setStroke(dp(1),ink)}})
                addView(text(tr("or use your email","অথবা ইমেইল ব্যবহার করুন"),13f).apply{gravity=Gravity.CENTER})
                val email=authInput(form,tr("Email address","ইমেইল ঠিকানা")).apply{inputType=33;setText(signInEmail);if(Build.VERSION.SDK_INT>=26)setAutofillHints("emailAddress")}
                val password=authInput(form,tr("Password","পাসওয়ার্ড"),true).apply{transformationMethod=android.text.method.PasswordTransformationMethod.getInstance();if(Build.VERSION.SDK_INT>=26)setAutofillHints(if(register)"newPassword" else "password")}
                val show=CheckBox(this@MainActivity).apply{text=tr("Show password","পাসওয়ার্ড দেখুন");setTextColor(ink);setOnCheckedChangeListener{_,checked->password.transformationMethod=if(checked)null else android.text.method.PasswordTransformationMethod.getInstance();password.setSelection(password.text.length)}};addView(show)
                val name=if(register)authInput(form,tr("Your name","আপনার নাম"))else null
                val ref=if(register||!invitationPrefs.getString("ref","").isNullOrBlank())authInput(form,tr("Invitation code · optional","আমন্ত্রণের কোড · ঐচ্ছিক")).apply{setText(invitationPrefs.getString("ref",""))}else EditText(this@MainActivity)
                invitationInput=ref
                addView(text(tr("New accounts joining with a valid invitation receive 5 N5 credits once. No advertisement required.","সঠিক আমন্ত্রণ কোডে নতুন অ্যাকাউন্ট খুললে একবার ৫ N5 ক্রেডিট ফ্রি পাবেন। বিজ্ঞাপন লাগবে না।"),12f))
                addView(button(if(register)tr("Create account","অ্যাকাউন্ট খুলুন")else tr("Sign in","লগইন")){
                    val mail=email.text.toString().trim();val pass=password.text.toString();val code=ref.text.toString().trim()
                    if(!android.util.Patterns.EMAIL_ADDRESS.matcher(mail).matches()){message(tr("Enter a valid email address.","সঠিক ইমেইল ঠিকানা দিন।"));return@button}
                    if(pass.isEmpty()||(register&&pass.length<10)){message(tr("New accounts need at least 10 password characters.","নতুন অ্যাকাউন্টের পাসওয়ার্ডে অন্তত ১০ অক্ষর দিন।"));return@button}
                    invitationPrefs.edit().putString("ref",code).apply()
                    runAuth({api.request(if(register)"/auth/register"else "/auth/login","POST",JSONObject().put("email",mail).put("password",pass).put("name",name?.text?.toString()?:"").put("referralCode",code))}){result->
                        password.text.clear();signInEmail=mail;acceptSession(result)
                    }
                })
                addView(button(if(register)tr("Already registered? Sign in","অ্যাকাউন্ট আছে? লগইন করুন")else tr("New here? Create an account","নতুন? অ্যাকাউন্ট খুলুন")){authMode=if(register)"login"else "register";draw()})
                if(!register)addView(button(tr("Forgot password? Contact support","পাসওয়ার্ড ভুলে গেছেন? সহায়তা নিন")){passwordSupport()})
            }
        }else{
            add(tr("Your study account","আপনার স্টাডি অ্যাকাউন্ট"),28f)
            card{addView(text(data.optJSONObject("user")?.optString("name")?.ifBlank{tr("Welcome","স্বাগতম")}?:tr("Welcome","স্বাগতম"),24f));addView(text(data.optJSONObject("user")?.optString("email")?:""))}
            val name=field(tr("Display name","আপনার নাম"));name.setText(data.optJSONObject("user")?.optString("name")?:"");area.addView(button(tr("Save profile","নাম সংরক্ষণ")){async({api.request("/profile","PATCH",JSONObject().put("name",name.text.toString()))}){refresh()}})
            card{addView(text(tr("Invite a friend","বন্ধুকে আমন্ত্রণ জানান"),23f));addView(text(tr("Your friend receives 5 N5 credits once after joining with your code.","আপনার কোড দিয়ে নতুন অ্যাকাউন্ট খুললে বন্ধু একবার ৫ N5 ক্রেডিট পাবেন।")));addView(button(tr("Show & share my invitation","আমার আমন্ত্রণ দেখুন ও শেয়ার করুন")){async({api.request("/referrals")}){r->val code=r.getString("code");val link="nihongopathbooks://join?ref="+android.net.Uri.encode(code);AlertDialog.Builder(this@MainActivity).setTitle(tr("Your invitation code","আপনার আমন্ত্রণ কোড")).setMessage(code+"\n\n"+tr("Open the link on Android with the app installed, or enter this code when joining.","Android-এ অ্যাপ install থাকলে লিংকটি খুলুন, অথবা অ্যাকাউন্ট খোলার সময় এই কোড দিন।")).setNegativeButton(tr("Close","বন্ধ"),null).setPositiveButton(tr("Share","শেয়ার")){_,_->startActivity(android.content.Intent.createChooser(android.content.Intent(android.content.Intent.ACTION_SEND).apply{type="text/plain";putExtra(android.content.Intent.EXTRA_TEXT,"Nihongo Path Books · 5 free N5 credits\n"+link+"\nCode: "+code)},tr("Invite a friend","বন্ধুকে আমন্ত্রণ")))}.show()}})}
            area.addView(button(tr("Bookmarks & progress","বুকমার্ক ও অগ্রগতি")){openReader("progress.html",null)})
            area.addView(button(tr("Reader settings","রিডারের সেটিংস")){openReader("settings.html",null)})
            if(data.optJSONObject("user")?.optString("role")=="admin")area.addView(button(tr("Admin Dashboard","অ্যাডমিন ড্যাশবোর্ড")){tab="Admin";draw()})
            area.addView(button(tr("Sync devices","সিঙ্ক করুন")){refresh()})
            area.addView(button(tr("Sign out","লগআউট")){async({api.request("/auth/logout","POST")}){vault.clear();WebStorage.getInstance().deleteAllData();data=JSONObject();draw()}})
            area.addView(button(tr("Sign out all devices","সব ডিভাইস থেকে লগআউট")){async({api.request("/auth/logout-all","POST")}){vault.clear();WebStorage.getInstance().deleteAllData();data=JSONObject();draw()}})
            area.addView(button(tr("Delete Nihongo app data","Nihongo অ্যাপের data মুছুন")){AlertDialog.Builder(this).setTitle(tr("Delete app data permanently?","অ্যাপের data স্থায়ীভাবে মুছবেন? ")).setMessage(tr("Credits, study progress and access will be removed. Your shared sign-in identity remains. An anonymous referral-bonus digest is retained to prevent duplicate bonuses.","ক্রেডিট, পড়ার অগ্রগতি ও অনুমতি মুছে যাবে। Shared login থাকবে। বারবার bonus নেওয়া ঠেকাতে পরিচয়ের একটি একমুখী hash রাখা হয়।")).setNegativeButton(tr("Cancel","বাতিল"),null).setPositiveButton(tr("Delete","মুছুন")){_,_->async({api.request("/account","DELETE")}){vault.clear();WebStorage.getInstance().deleteAllData();data=JSONObject();draw()}}.show()})
        }
    }
    @Suppress("SetJavaScriptEnabled")
    private fun openReader(route:String,level:String?){
        if(level=="N1"||(route.startsWith("listening")&&level!="N5")){message("Unavailable in this release");return}
        if(!previewMode&&level!=null&&expiry(level)<=now()){tab="Rewards";draw();return}
        readerLevel=level;readerExpiry=level?.let{expiry(it)}?:Long.MAX_VALUE
        val container=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(0,dp(28),0,0);setBackgroundColor(paper)}
        container.addView(button(tr("← Library","← বইঘর")){closeReader()})
        val loader=WebViewAssetLoader.Builder().addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(this)).build()
        val view=WebView(this);web=view
        view.settings.apply{javaScriptEnabled=true;domStorageEnabled=true;allowFileAccess=false;allowContentAccess=false;cacheMode=WebSettings.LOAD_NO_CACHE;setSupportMultipleWindows(false);mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW;mediaPlaybackRequiresUserGesture=true}
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
            @JavascriptInterface fun speak(text:String){runOnUiThread{tts?.speak(text.take(2000),TextToSpeech.QUEUE_FLUSH,null,"study")}}
            @JavascriptInterface fun stopSpeech(){tts?.stop()}
            @JavascriptInterface fun unlock(){runOnUiThread{closeReader();tab=if(vault.read().isEmpty())"Account" else "Rewards";draw()}}
        },"StudyNative")
        view.webViewClient=object:WebViewClient(){
            override fun shouldOverrideUrlLoading(v:WebView,r:WebResourceRequest):Boolean {
                if(!Access.internal(r.url.toString())){message(tr("This link is outside the study library.","এই লিংকটি স্টাডি লাইব্রেরির বাইরে।"));return true}
                val p=r.url.path?:""
                val next=Regex("/n([1-5])\\.html$").find(p)?.let{"N"+it.groupValues[1]}
                if(next!=null&&next!=readerLevel){closeReader();chooseSubject(next);return true}
                if(p.endsWith("listening.html")){val n=r.url.getQueryParameter("level")?:"N5";if(n!=readerLevel){closeReader();chooseSubject(n);return true}}
                return false
            }
            override fun shouldInterceptRequest(v:WebView,r:WebResourceRequest):WebResourceResponse {
                fun denied(code:Int=403)=WebResourceResponse("text/plain","UTF-8",code,if(code==403)"Forbidden" else "Unavailable",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream("Access unavailable. Return to Reward Center and refresh.".toByteArray()))
                if(!Access.internal(r.url.toString()))return denied()
                val path=r.url.path!!.removePrefix("/assets/reader/")
                if(Regex("(?:^|/)(?:lessons-|owner-|listening-|jlpt-)?n1(?:[./-])").containsMatchIn(path)||Regex("^data/listening-n[2-4]\\.json$").matches(path)||Regex("^audio/(?:listening/)?n[1-4]/").containsMatchIn(path))return denied()
                val protected=path.startsWith("pdfs/")||path.startsWith("audio/")||Regex("^data/(?:lessons-|owner-|listening-)?n[1-5]\\.json$").matches(path)||path=="data/extra.json"
                if(protected&&previewMode){
                    if(!Regex("^data/lessons-n[2-5]\\.json$").matches(path))return denied()
                    return try{WebResourceResponse("application/json","UTF-8",assets.open("reader/previews/"+path.substringAfterLast('/')))}catch(_:Exception){denied()}
                }
                if(protected){return try{val (type,bytes)=api.content(path);WebResourceResponse(type.substringBefore(';'),null,200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream(bytes))}catch(_:Exception){denied(503)}}
                return loader.shouldInterceptRequest(r.url)?:denied()
            }
            override fun onPageFinished(v:WebView,url:String){
                if(url.contains("/study.html")){
                    val restored=data.optJSONObject("studyState")
                    if(restored!=null&&restored.length()>0)v.evaluateJavascript("Object.assign(state,JSON.parse(${JSONObject.quote(restored.toString())}));state.saved??=[];localStorage.setItem('nihongo-path',JSON.stringify(state));if(data.vocab)render();",null)
                    return
                }
                val synced=data.optJSONObject("studyState")
                val initial=if(synced!=null&&synced.length()>0)synced.toString() else "{}"
                v.evaluateJavascript("if(typeof state!=='undefined'){const requestedLevel=state.level;Object.assign(state,JSON.parse(${JSONObject.quote(initial)}));state.level=requestedLevel;if(state.positions&&typeof readerIndex!=='undefined')readerIndex=state.positions[state.level+':'+kind]||0;}",null)
                v.evaluateJavascript("localStorage.setItem('nihongo-path',JSON.stringify({...state,lang:'${if(bn)"bn" else "en"}'}));if(typeof state!=='undefined'){state.lang='${if(bn)"bn" else "en"}';persist();render();}",null)}
        }
        container.addView(view,LinearLayout.LayoutParams(-1,0,1f));setContentView(container);view.loadUrl("https://appassets.androidplatform.net/assets/reader/$route")
    }
    private fun closeReader(){web?.apply{stopLoading();loadUrl("about:blank");removeJavascriptInterface("StudyNative");clearCache(true);destroy()};web=null;readerLevel=null;previewMode=false;tts?.stop();draw()}
    override fun onPause(){web?.onPause();tts?.stop();super.onPause()}
    override fun onResume(){super.onResume();web?.onResume();if(web!=null&&!previewMode&&readerLevel!=null)refresh{if(expiry(readerLevel!!)<=now())closeReader()}}
    override fun onDestroy(){handler.removeCallbacksAndMessages(null);web?.destroy();tts?.shutdown();worker.shutdownNow();syncWorker.shutdownNow();super.onDestroy()}
}
