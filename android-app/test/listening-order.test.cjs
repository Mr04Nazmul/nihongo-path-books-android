const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../reader/listening-core.js'),root=path.resolve(__dirname,'../app/build/generated/study-assets/reader');
test('both complete papers have a deterministic year/group order and exactly two free groups per level',()=>{
 for(const level of C.levels){
  const d=JSON.parse(fs.readFileSync(path.join(root,'previews/listening',level.toLowerCase(),'catalog.json')));
  assert(C.validCatalog(d,level));const ordered=C.orderedSections([...d.sections].reverse());
  assert.deepEqual(ordered.map(s=>C.serial(s,level)),ordered.map((_,i)=>i+1));
  assert.deepEqual(ordered.filter(C.freeSection).map(s=>s.id),['2012-'+level.toLowerCase()+'-g1','2012-'+level.toLowerCase()+'-g2']);
  for(const s of ordered){
   const folder=path.join(root,'previews',path.dirname(s.audio));
   assert.equal(fs.existsSync(folder),C.freeSection(s),s.id);
   if(C.freeSection(s)){
    assert(fs.statSync(path.join(root,'previews',s.audio)).size>100000);
    const answers=JSON.parse(fs.readFileSync(path.join(root,'previews',s.answerKey))).answers;
    assert.equal(answers.length,s.questionCount);
    s.questions.forEach((q,i)=>{assert(answers[i]>=1&&answers[i]<=q.options);for(const image of q.sourcePages||[q.image].filter(Boolean))assert(fs.existsSync(path.join(root,'previews',image)),image)});
   }
  }
 }
 assert(fs.existsSync(path.join(root,'previews/listening/n1')));
});
test('paid groups, partial samples and incorrect years never count as free',()=>{
 for(const year of ['2009','2018','2020'])for(const group of [1,2,3])assert(!C.freeSection({kind:'practice',year,group}));
 assert(!C.freeSection({kind:'sample',year:'2012',group:1}));assert(!C.freeSection({kind:'practice',year:'2012',group:3}));
});
