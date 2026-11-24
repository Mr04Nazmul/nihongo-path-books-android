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
  if (window.AdaptiveReader) window.AdaptiveReader.mount(data, level, preview, mainWord, meaning);
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
    var scores=window.AdaptiveReader.compareWriting(paths.map(function(p){return p.points}),template);
    if(!scores){status.textContent='প্রতিটি স্ট্রোক টেনে লিখুন।';return;}
    status.textContent='গাইডের সঙ্গে সবচেয়ে বেশি পার্থক্য · স্ট্রোক '+(scores.indexOf(Math.max.apply(null,scores))+1);
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
