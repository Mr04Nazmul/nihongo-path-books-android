import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {readFile} from 'node:fs/promises';
test('N2 content remains authenticated and level-gated before serving the expanded curriculum',async()=>{
 const oldDeno=globalThis.Deno,oldFetch=globalThis.fetch;let handler;
 globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://fixture.invalid':'fixture-key'},serve:fn=>{handler=fn}};
 try{
  const result=await build({entryPoints:[new URL('../../supabase/functions/nihongo-books-v1/index.ts',import.meta.url).pathname],bundle:true,format:'esm',platform:'neutral',write:false});await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  const curriculum=JSON.parse(await readFile(new URL('../../curriculum/lessons-n2.json',import.meta.url)));const catalog=JSON.parse(await readFile(new URL('../../curriculum/kanji-catalog.json',import.meta.url)));const strokes=JSON.parse(await readFile(new URL('../../curriculum/kanji-strokes.json',import.meta.url)));
  let allowed=false,allowedLevel='N2';const calls=[];globalThis.fetch=async(url,opts)=>{assert.match(String(url),/^https:\/\/fixture.invalid\/rest\/v1\/rpc\//);const request=JSON.parse(opts.body);calls.push(request.action||'premium');if(String(url).endsWith('/nihongo_premium_read')){let payload;const path=request.asset_path;if(path==='data/lessons-n2.json')payload=curriculum;else if(path.startsWith('kanji/')){const level=path.split('/')[1].slice(0,-5);payload={level:level.toUpperCase(),entries:catalog[level]}}else if(path.startsWith('strokes/')){const [,level,id]=path.split('/');const data=strokes[id.slice(0,-5)];if(data&&catalog[level].some(e=>e.character===data.character))payload=data}return Response.json(payload?{mime:'application/json',payload}:{error:'Material unavailable',status:404})}return Response.json(request.action==='authenticate'?{user:{role:'student'}}:request.action==='allowed'?{allowed:allowed&&request.payload.level===allowedLevel}:request.action==='published'?{chapters:[],audio:[]}:{ok:true})};
  const url='https://fixture.invalid/functions/v1/nihongo-books-v1/content/data/lessons-n2.json';const headers={Authorization:'Bearer '+'a'.repeat(43)};
  assert.equal((await handler(new Request(url))).status,401);
  let response=await handler(new Request(url,{headers}));assert.equal(response.status,403);assert.ok(!calls.includes('published'));
  allowed=true;response=await handler(new Request(url,{headers}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.vocab.length,2443);assert.equal(data.grammar.length,208);assert.equal(data.kanji.length,400);assert.match(response.headers.get('cache-control'),/private/);
  const contentUrl=path=>'https://fixture.invalid/functions/v1/nihongo-books-v1/content/'+path;
  response=await handler(new Request(contentUrl('kanji/n2.json'),{headers}));assert.equal(response.status,200);assert.equal((await response.json()).entries.length,400);
  allowedLevel='N5';assert.equal((await handler(new Request(contentUrl('kanji/n2.json'),{headers}))).status,403);
  assert.equal((await handler(new Request(contentUrl('strokes/n2/0515a.json'),{headers}))).status,403);
  assert.equal((await handler(new Request(contentUrl('kanji/n5.json'),{headers}))).status,200);
  assert.equal((await handler(new Request(contentUrl('strokes/n5/05c71.json'),{headers}))).status,200);
  assert.equal((await handler(new Request(contentUrl('strokes/n5/0515a.json'),{headers}))).status,404);
  assert.equal((await handler(new Request(contentUrl('kanji/n1.json'),{headers}))).status,403);
  allowed=false;assert.equal((await handler(new Request(contentUrl('strokes/n5/05c71.json'),{headers}))).status,403);

 }finally{globalThis.Deno=oldDeno;globalThis.fetch=oldFetch}
});
