import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';import {handleNode,store} from '../src/handler.mjs';
test('Android HTTP contract: auth, state isolation, admin levels and secure N1 boundaries',async()=>{
 const db=new PGlite();for(const n of ['001_initial.sql','002_android_release.sql'])await db.exec(await readFile(new URL('../migrations/'+n,import.meta.url),'utf8'));
 let previous=Promise.resolve();const original=store.pool;store.pool={async connect(){let release;const wait=previous;previous=new Promise(r=>release=r);await wait;return {query:async(sql,values)=>{const r=await db.query(sql,values);return {...r,rowCount:r.rows?.length||r.affectedRows||0}},release}}};
 const old=process.env.AUTH_PROVIDER;process.env.AUTH_PROVIDER='legacy';const server=http.createServer(handleNode);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,method='GET',body,token)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}};
 try{
  assert.equal((await call('/me')).status,401);
  const create=()=>call('/auth/register','POST',{email:randomUUID()+'@example.test',password:'long-test-password'});
  const a=(await create()).data,b=(await create()).data;
  assert.equal((await call('/admin/overview','GET',null,a.token)).status,403);
  assert.equal((await call('/ads/session','POST',{level:'N1'},a.token)).status,400);
  assert.equal((await call('/redeem','POST',{tierId:'N1-18000',requestId:randomUUID()},a.token)).status,400);
  for(const p of ['data/n1.json','data/listening-n4.json','data/lessons-n5.json'])assert.equal((await call('/content/'+p,'GET',null,a.token)).status,403);
  assert.equal((await call('/study-state','PUT',{state:{saved:['vocab:N5:one'],positions:{'N5:vocab':9},credits:999999}},a.token)).status,200);
  const own=(await call('/me','GET',null,a.token)).data,other=(await call('/me','GET',null,b.token)).data;
  assert.equal(own.studyState.positions['N5:vocab'],9);assert.equal(own.studyState.credits,undefined);assert.deepEqual(other.studyState,{});assert.deepEqual(own.balances,[]);
  await store.tx(c=>c.query("update books.users set role='admin' where id=$1",[a.user.id]));
  assert.equal((await call('/admin/level','PATCH',{level:'N1',enabled:true},a.token)).status,409);
  assert.equal((await call('/admin/tier','PATCH',{id:'N1-18000',seconds:18000,credits:1,enabled:true},a.token)).status,409);
  assert.equal((await call('/admin/level','PATCH',{level:'N4',enabled:false},a.token)).status,200);
  assert.equal((await call('/ads/session','POST',{level:'N4'},a.token)).status,403);
  assert.equal((await call('/auth/logout','POST',{},a.token)).status,200);assert.equal((await call('/me','GET',null,a.token)).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));store.pool=original;await original.end();await db.close();if(old===undefined)delete process.env.AUTH_PROVIDER;else process.env.AUTH_PROVIDER=old}
});
