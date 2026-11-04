const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('../backend/node_modules/jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'reader/study.html'),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const flush=()=>new Promise(setImmediate);
test('vocabulary sound sends the full kana reading for 私 and other ambiguous words',async()=>{
 const dom=new JSDOM(html,{url:'https://appassets.androidplatform.net/assets/reader/study.html?level=N5&section=vocab&preview=1',runScripts:'outside-only'}),w=dom.window,spoken=[];
 try{
  const data=JSON.parse(fs.readFileSync(path.join(root,'offline-shell/data/lessons-n5.json')));
  w.StudyNative={speak:s=>spoken.push(s)};w.fetch=async()=>({ok:true,json:async()=>data});w.eval(script);await flush();await flush();
  w.document.querySelector('[data-sound="own-n5-vocab-0001"]').click();assert.equal(spoken.pop(),'わたし');
  w.document.querySelector('[data-sound="own-n5-vocab-0002"]').click();assert.equal(spoken.pop(),'わたしたち');
  w.document.querySelector('[data-tab="grammar"]').click();w.document.querySelector('[data-sound]').click();assert.equal(spoken.pop(),data.grammar[0].reading||data.grammar[0].pattern_reading||data.grammar[0].pattern);
 }finally{w.close()}
});
test('packaged app excludes every listening page, controller and audio file',()=>{
 const generated=path.join(root,'app/build/generated/study-assets/reader');
 function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)])}
 for(const p of files(generated))assert.doesNotMatch(p.slice(generated.length),/listening|\.mp3$/i);
 const kanji=new JSDOM(fs.readFileSync(path.join(root,'reader/kanji.html'),'utf8'));
 try{assert.equal(kanji.window.document.querySelector('[data-nav="Quiz"]'),null);assert.equal(kanji.window.document.querySelectorAll('.bottom button').length,4)}finally{kanji.window.close()}
});
