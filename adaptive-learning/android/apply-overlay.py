"""Apply the adaptive reader overlay to the saved 1.19.3 Gradle candidate."""
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
overlay = Path(__file__).resolve().parent
app = root / 'app' / 'src' / 'main'
reader = app / 'assets' / 'reader'
java = app / 'java' / 'online' / 'devnazu' / 'books'

def replace(path, old, new):
    source = path.read_text()
    if source.count(old) != 1:
        raise SystemExit(f'Unexpected candidate source at {path.name}')
    path.write_text(source.replace(old, new))

shutil.copy2(overlay / 'AdaptiveHistory.java', java / 'AdaptiveHistory.java')
shutil.copy2(overlay / 'adaptive-reader.js', reader / 'adaptive-reader.js')
replace(reader / 'study.html', '</head>', '<script src="adaptive-reader.js"></script></head>')
replace(reader / 'study.html', '  migrateAliases();\n  render();\n}).catch', '''  migrateAliases();
  render();
  if (window.AdaptiveReader) window.AdaptiveReader.mountFromAssets(data, level, preview, mainWord, meaning);
}).catch''')
replace(reader / 'kanji.html', '<script src="practice.js">', '<script src="adaptive-reader.js"></script><script src="practice.js">')
replace(java / 'MainActivity.java', 'new MainActivity$openReader$4(this, requestPreview, requestPage)', 'new MainActivity$openReader$4(this, requestPreview, requestPage, level)')
bridge = java / 'MainActivity$openReader$4.java'
replace(bridge, 'MainActivity$openReader$4(MainActivity $receiver, boolean $requestPreview, String $requestPage) {', '''private final String adaptiveLevel;
    private final String adaptiveOwner;
    private final String adaptiveCredential;

    MainActivity$openReader$4(MainActivity $receiver, boolean $requestPreview, String $requestPage, String level) {
        this.adaptiveLevel = level;
        this.adaptiveOwner = currentAdaptiveOwner($receiver);
        this.adaptiveCredential = MainActivity.access$getVault$p($receiver).read();''')
replace(bridge, '    @JavascriptInterface\n    public final String appearance()', '''    private static String currentAdaptiveOwner(MainActivity activity) {
        JSONObject user = MainActivity.access$getData$p(activity).optJSONObject("user");
        return user != null && !user.optString("id").isEmpty() ? user.optString("id") : "guest";
    }

    private boolean adaptiveAllowed() {
        return "study.html".equals(this.$requestPage) && adaptiveLevel != null
            && adaptiveOwner.equals(currentAdaptiveOwner(this.this$0))
            && adaptiveCredential.equals(MainActivity.access$getVault$p(this.this$0).read())
            && (this.$requestPreview || (!adaptiveCredential.isEmpty()
                && MainActivity.access$expiry(this.this$0, adaptiveLevel) > MainActivity.access$now(this.this$0)));
    }

    @JavascriptInterface
    public final String adaptiveHistory() {
        if (!adaptiveAllowed()) return "";
        String prefix = adaptiveLevel + ":" + (this.$requestPreview ? "preview:" : "full:");
        return AdaptiveHistory.get(this.this$0).recent(adaptiveOwner, prefix);
    }

    @JavascriptInterface
    public final boolean recordAdaptiveAnswer(String event) {
        return adaptiveAllowed() && AdaptiveHistory.get(this.this$0)
            .append(adaptiveOwner, adaptiveLevel, this.$requestPreview, event);
    }

    @JavascriptInterface
    public final String appearance()''')
replace(reader / 'practice.js',
        'var modes=panel.querySelectorAll',
        '''if (window.AdaptiveReader) {
  var inspect=document.createElement('button');
  inspect.type='button';
  inspect.textContent='স্ট্রোক মিলিয়ে দেখুন';
  panel.querySelector('#practiceGuide').parentNode.appendChild(inspect);
  inspect.onclick=function(){
    var status=document.getElementById('practiceStatus');
    var svg=document.querySelector('#animation svg');
    var reference=svg?Array.from(new Set(Array.from(svg.querySelectorAll('path')).map(function(p){return p.getAttribute('d')}))):[];
    if(!reference.length){status.textContent='কানজির স্ট্রোক গাইড লোড হওয়া পর্যন্ত অপেক্ষা করুন।';return;}
    if(paths.some(function(p){return p.erase})){status.textContent='স্ট্রোক তুলনার জন্য ইরেজার ছাড়া আবার লিখুন।';return;}
    if(paths.length!==reference.length){status.textContent='আপনার স্ট্রোক '+paths.length+' · গাইডে '+reference.length;return;}
    var template=reference.map(function(d){
      var path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',d);
      var length=path.getTotalLength();
      return Array.from({length:32},function(_,i){
        var point=path.getPointAtLength(length*i/31);
        return [point.x/109,point.y/109];
      });
    });
    var result=window.AdaptiveReader.assessWriting(paths.map(function(p){return p.points}),template);
    if(window.StudyNative && window.StudyNative.adaptiveWriting) {
      window.StudyNative.adaptiveWriting(document.querySelector('#character').textContent.trim(), JSON.stringify(result));
    }
    if(!result.strokes){status.textContent='প্রতিটি স্ট্রোক টেনে লিখুন।';return;}
    var reversed=result.strokes.findIndex(function(s){return s.reversed;});
    var misplaced=result.strokes.findIndex(function(s){return s.otherStroke!==null;});
    var shape=result.strokes.map(function(s){return s.shape;});
    if(reversed!==-1)status.textContent='স্ট্রোকের দিক দেখুন · '+(reversed+1);
    else if(misplaced!==-1)status.textContent='স্ট্রোকের ক্রম দেখুন · '+(misplaced+1);
    else status.textContent='গাইডের সঙ্গে সবচেয়ে বেশি পার্থক্য · স্ট্রোক '+(shape.indexOf(Math.max.apply(null,shape))+1);
  };
}
var modes=panel.querySelectorAll''')
activity = java / 'MainActivity.java'
source = activity.read_text()
marker = 'private static final Unit accountSecurity$lambda$253$lambda$252$lambda$251('
before, sep, after = source.partition(marker)
if not sep:
    raise SystemExit('Missing account deletion callback')
after = after.replace(
    '        tokenVault.clear();',
    '''        JSONObject deletedUser = this$0.data.optJSONObject("user");
        if (deletedUser != null && !deletedUser.optString("id").isEmpty()) {
            AdaptiveHistory.get(this$0).deleteOwner(deletedUser.optString("id"));
        }
        tokenVault.clear();''', 1)
activity.write_text(before + sep + after)
replace(root / 'app' / 'build.gradle', "versionCode 33; versionName '1.19.3'",
        "versionCode 34; versionName '1.20.0-adaptive-preview'")

shutil.copy2(overlay / 'AdaptiveSync.java', java / 'AdaptiveSync.java')
replace(root / 'app' / 'build.gradle', ' buildFeatures { buildConfig true }', ''' buildFeatures { buildConfig true }
 defaultConfig { buildConfigField 'boolean', 'ADAPTIVE_SYNC', (System.getenv('BOOKS_ADAPTIVE_SYNC') == 'true' ? 'true' : 'false') }''')
books_api = java / 'BooksApi.java'
replace(books_api,
        '    public final JSONObject request(String path, String method, JSONObject data) {',
        '''    public final JSONObject request(String path, String method, JSONObject data) {
        return requestWithCredential(path, method, data, String.valueOf(this.token.invoke()));
    }

    final JSONObject requestWithCredential(String path, String method, JSONObject data, String credential) {''')
replace(books_api,
        '.url(StringsKt.trimEnd(BuildConfig.API_BASE, \'/\') + path).header("Authorization", "Bearer " + ((Object) this.token.invoke()));',
        '.url(StringsKt.trimEnd(BuildConfig.API_BASE, \'/\') + path).header("Authorization", "Bearer " + credential);')
replace(bridge,
        '''        return adaptiveAllowed() && AdaptiveHistory.get(this.this$0)
            .append(adaptiveOwner, adaptiveLevel, this.$requestPreview, event);''',
        '''        if (!adaptiveAllowed() || !AdaptiveHistory.get(this.this$0)
            .append(adaptiveOwner, adaptiveLevel, this.$requestPreview, event)) return false;
        AdaptiveSync.run(this.this$0, adaptiveOwner, adaptiveCredential);
        return true;''')
replace(activity, '        this.data = snapshot;', '''        this.data = snapshot;
        JSONObject adaptiveUser = snapshot.optJSONObject("user");
        if (adaptiveUser != null && this.vault != null) {
            AdaptiveSync.run(this, adaptiveUser.optString("id"), this.vault.read());
        }''')
backend = root / 'backend-snapshot'
shutil.copy2(overlay / 'adaptive-sync-route.ts', backend / 'adaptive-sync-route.ts')
replace(backend / 'index.ts', "import {Fault} from './errors.ts';",
        "import {Fault} from './errors.ts';\nimport {validateAdaptiveBatch} from './adaptive-sync-route.ts';")
replace(backend / 'index.ts', "  const me=await rpc('authenticate',{tokenHash});",
        '''  const me=await rpc('authenticate',{tokenHash});
  if(route==='/adaptive-sync'&&req.method==='POST'){
   const batch=validateAdaptiveBatch(await body(req));
   if(!batch)throw new Fault(400,'Invalid adaptive review batch');
   const response=await fetch(project+'/rest/v1/rpc/nihongo_adaptive_sync',{
    method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
    body:JSON.stringify({token_hash:tokenHash,after_cursor:batch.after,events:batch.events}),
    signal:AbortSignal.timeout(15000),
   });
   if(!response.ok)throw new Fault(503,'Adaptive sync is unavailable');
   const synced=await response.json();
   if(synced.error)throw new Fault(synced.status||400,synced.error);
   return json(synced);
  }''')

replace(bridge, '    @JavascriptInterface\n    public final String adaptiveHistory()', '''    @JavascriptInterface
    public final String adaptiveStudySessions() {
        if (!adaptiveAllowed() || !DailyReminder.enabled(this.this$0)
                || !DailyReminder.allowed(this.this$0)) return "[]";
        return AdaptiveHistory.get(this.this$0).sessionStarts(adaptiveOwner, System.currentTimeMillis());
    }

    @JavascriptInterface
    public final void adaptiveReminder(long when) {
        if (adaptiveAllowed()) DailyReminder.setAdaptiveTime(this.this$0, when);
    }

    @JavascriptInterface
    public final String adaptiveHistory()''')
reminder = java / 'DailyReminder.java'
replace(reminder, ' public static void schedule(Context c){if(!enabled(c))return;AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,nextTime(System.currentTimeMillis(),TimeZone.getDefault()),pending(c));}',
        ''' static boolean quiet(long time) {
  Calendar local=Calendar.getInstance();local.setTimeInMillis(time);
  int hour=local.get(Calendar.HOUR_OF_DAY);return hour<8||hour>=21;
 }
 public static void setAdaptiveTime(Context c,long when) {
  if(!enabled(c)||!allowed(c))return;
  long now=System.currentTimeMillis();
  if(when>now&&when-now<=172800000L&&!quiet(when))prefs(c).edit().putLong("adaptive_time",when).apply();
  else prefs(c).edit().remove("adaptive_time").apply();
  schedule(c);
 }
 public static void schedule(Context c){
  if(!enabled(c)||!allowed(c))return;
  long now=System.currentTimeMillis();TimeZone zone=TimeZone.getDefault();
  String last=prefs(c).getString("last_day","");
  long next=nextTime(now,zone);
  if(last.equals(dateKey(next,zone)))next=nextTime(next,zone);
  long personal=prefs(c).getLong("adaptive_time",0);
  if(personal>now&&!quiet(personal)&&!last.equals(dateKey(personal,zone)))next=personal;
  AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
  am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,pending(c));
 }''')
replace(reminder, 'if(!enabled(c)||!allowed(c))return;String today=dateKey',
        'if(!enabled(c)||!allowed(c)||quiet(System.currentTimeMillis()))return;String today=dateKey')

replace(bridge, '    @JavascriptInterface\n    public final String adaptiveHistory()', '''    @JavascriptInterface
    public final void adaptiveWriting(String glyph, String summary) {
        if ("kanji.html".equals(this.$requestPage) && adaptiveLevel != null
            && adaptiveOwner.equals(currentAdaptiveOwner(this.this$0))
            && adaptiveCredential.equals(MainActivity.access$getVault$p(this.this$0).read())
            && (this.$requestPreview || (!adaptiveCredential.isEmpty()
                && MainActivity.access$expiry(this.this$0, adaptiveLevel) > MainActivity.access$now(this.this$0)))) {
            AdaptiveHistory.get(this.this$0).recordWriting(adaptiveOwner, adaptiveLevel, glyph, summary);
        }
    }

    @JavascriptInterface
    public final String adaptiveHistory()''')
