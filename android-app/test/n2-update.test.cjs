const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');const curriculum=JSON.parse(fs.readFileSync(path.join(root,'curriculum/lessons-n2.json')));const audit=JSON.parse(fs.readFileSync(path.join(root,'curriculum/n2-import-audit.json')));const norm=s=>s.normalize('NFKC').replace(/\s/g,'');
test('all 2,273 supplied source notes are represented exactly once without duplicate words',()=>{
 const serials=curriculum.vocab.flatMap(e=>e.deck_serials||[]).sort((a,b)=>a-b);assert.deepEqual(serials,Array.from({length:2273},(_,i)=>i+1));assert.equal(new Set(curriculum.vocab.map(e=>norm(e.word))).size,curriculum.vocab.length);assert.equal(curriculum.vocab.length,2443);assert.equal(new Set(curriculum.vocab.map(e=>e.id)).size,2443);
 assert.equal(audit.added,1250);assert.equal(audit.duplicate_ids_removed.length,4);
 for(const [i,e]of curriculum.vocab.entries()){assert.equal(e.entry_number,i+1);assert.equal(e.level,'N2');assert.ok(e.word&&e.reading&&e.meaning);assert.doesNotMatch(e.meaning,/[\uFFFD\u0000]/)}
});
test('source fixes keep correct Japanese and Bengali while preserving alias IDs',()=>{
 assert.equal(curriculum.vocab.find(e=>e.deck_serials?.includes(328)).meaning,'মেঘমুক্ত রৌদ্রোজ্জ্বল আবহাওয়া');assert.equal(curriculum.vocab.find(e=>e.deck_serials?.includes(2235)).word,'立方センチメートル');assert.equal(curriculum.vocab.find(e=>e.deck_serials?.includes(738)).meaning,'বসা');assert.equal(curriculum.kanji.length,400);assert.equal(curriculum.grammar.length,208);assert.equal(curriculum.grammar.reduce((n,e)=>n+e.examples.length,0),403);
 for(const id of audit.duplicate_ids_removed)assert.equal(curriculum.vocab.filter(e=>e.alias_ids?.includes(id)).length,1);
});
const source=fs.readFileSync(path.join(root,'reader/study.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function reader(search,payload,saved=[]){const nodes={};const node=id=>nodes[id]??=( {innerHTML:'',textContent:'',hidden:false,value:'',querySelector:()=>node('close'),append(){},addEventListener(){},showModal(){},close(){}} );let requests=0;const context=vm.createContext({URLSearchParams,location:{search},localStorage:{getItem:()=>JSON.stringify({saved}),setItem(){}},window:{},document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>({style:{}})},fetch:async()=>{requests++;return {ok:true,json:async()=>payload}}});vm.runInContext(source,context);return {context,node,requests:()=>requests}}
test('free reader caps every subject at five even if a full server payload arrives',async()=>{
 const r=reader('?level=N2&preview=1',curriculum);await new Promise(setImmediate);for(const k of ['vocab','grammar','kanji']){vm.runInContext(`kind='${k}';render()`,r.context);assert.equal((r.node('#content').innerHTML.match(/<article /g)||[]).length,5)}assert.doesNotMatch(r.node('#tabs').innerHTML,/Quiz|quiz/);
});
test('bookmarks on merged duplicate IDs still resolve to the preserved entry',async()=>{const target=curriculum.vocab.find(e=>e.alias_ids?.length);const r=reader('?level=N2&saved=1',curriculum,['N2:'+target.alias_ids[0]]);await new Promise(setImmediate);assert.ok(r.node('#content').innerHTML.includes('data-id="'+target.id+'"'))});
