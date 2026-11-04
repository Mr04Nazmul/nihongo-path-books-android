const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('../backend/node_modules/jsdom');
const base=path.resolve(__dirname,'..'),generated=path.join(base,'app/build/generated/study-assets/reader');
const flush=()=>new Promise(setImmediate);
function page(level='N5',preview=true){
 const dom=new JSDOM(fs.readFileSync(path.join(base,'reader/listening.html'),'utf8'),{url:'https://appassets.androidplatform.net/assets/reader/listening.html?level='+level,runScripts:'outside-only'}),w=dom.window,calls=[],players=[];let unlocks=0;
 w.StudyNative={learningProfile:()=> 'test-profile',readerAccess:()=>JSON.stringify({preview}),unlock:()=>unlocks++,backToLibrary:()=>{}};w.confirm=()=>true;
 w.fetch=async p=>{calls.push(p);const file=path.join(generated,'previews',p);return {ok:fs.existsSync(file),status:fs.existsSync(file)?200:403,json:async()=>JSON.parse(fs.readFileSync(file))}};
 w.Audio=class{constructor(){this.paused=true;this.currentTime=0;this.duration=200;players.push(this)}load(){}pause(){this.paused=true;if(this.onpause)this.onpause()}removeAttribute(){}play(){this.paused=false;if(this.onplay)this.onplay();return Promise.resolve()}};
 w.eval(fs.readFileSync(path.join(base,'reader/listening-core.js'),'utf8'));w.eval(fs.readFileSync(path.join(base,'reader/listening.js'),'utf8'));
 return {dom,w,calls,players,unlocks:()=>unlocks};
}
test('catalogues render in sequence and locked selections request reward without opening media',async()=>{
 for(const level of ['N5','N4','N3','N2']){
  const s=page(level);try{await flush();await flush();const rows=[...s.w.document.querySelectorAll('[data-section]')];assert(rows.length>=8);assert.equal(rows[0].dataset.section,'2012-'+level.toLowerCase()+'-g1');assert.equal(rows[1].dataset.section,'2012-'+level.toLowerCase()+'-g2');assert.equal(rows.filter(x=>!x.classList.contains('reward-locked')).length,2);
   rows[2].click();assert.equal(s.unlocks(),1);assert.equal(s.players.length,0);assert.equal(s.calls.length,1);
   rows[0].click();assert.equal(s.players.length,1);assert.equal(s.players[0].src,'listening/'+level.toLowerCase()+'/2012/g1/audio.mp3');const src=s.players[0].src;s.w.document.querySelector('#next').click();assert.equal(s.players.length,1);assert.equal(s.players[0].src,src);
  }finally{s.dom.window.close()}
 }
});
test('free source-group answers score correctly and attempts keep answers/flags on reload',async()=>{
 const s=page();try{await flush();await flush();s.w.document.querySelector('[data-section]').click();s.w.document.querySelector('[data-answer="2"]').click();s.w.document.querySelector('#flag').click();s.w.document.querySelector('#next').click();s.w.document.querySelector('#back').click();s.w.document.querySelector('[data-section]').click();assert(s.w.document.querySelector('[data-q="1"]').classList.contains('selected'));s.w.document.querySelector('#previous').click();assert.equal(s.w.document.querySelector('[data-answer="2"]').getAttribute('aria-pressed'),'true');assert(s.w.document.querySelector('#flag').classList.contains('active'));
  const answers=JSON.parse(fs.readFileSync(path.join(generated,'previews/listening/n5/2012/g1/answers.json'))).answers;
  for(let i=0;i<answers.length;i++){s.w.document.querySelector('[data-q="'+i+'"]').click();s.w.document.querySelector('[data-answer="'+answers[i]+'"]').click()}
  s.w.document.querySelector('#next').click();await flush();await flush();assert.equal(s.w.document.querySelector('.paper-card h2').textContent,answers.length+' / '+answers.length);assert(s.calls.includes('listening/n5/2012/g1/answers.json'));
 }finally{s.dom.window.close()}
});
