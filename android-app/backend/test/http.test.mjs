import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';import {randomUUID} from 'node:crypto';import {Store} from '../src/store.mjs';
test('HTTP: fail-closed auth, admin RBAC, bad reward, profile, logout and service errors',{skip:!process.env.TEST_DATABASE_URL||process.env.TEST_DATABASE_URL==='pglite'},async()=>{
 const port=18881,base=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['src/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:process.env.TEST_DATABASE_URL},stdio:['ignore','pipe','pipe']});
 const store=new Store(process.env.TEST_DATABASE_URL);let id;
 try{
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server startup timeout')),10000).unref())]);
  const call=(route,method='GET',data,token)=>fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});
  assert.equal((await call('/me')).status,401);assert.equal((await call('/content/data/lessons-n5.json')).status,401);
  const r=await call('/auth/register','POST',{email:randomUUID()+'@example.test',password:'http-test-password'});assert.equal(r.status,200);const login=await r.json();id=login.user.id;
  assert.equal((await call('/admin/overview','GET',null,login.token)).status,403);
  assert.equal((await call('/content/data/lessons-n5.json','GET',null,login.token)).status,403);
  assert.equal((await call('/ssv?signature=fake&key_id=1')).status,400);
  assert.equal((await call('/redeem','POST',{tierId:'N5-18000',requestId:randomUUID()},login.token)).status,409);
  assert.equal((await call('/profile','PATCH',{name:'Study user'},login.token)).status,200);
  const me=await (await call('/me','GET',null,login.token)).json();assert.equal(me.user.name,'Study user');
  await store.tx(c=>c.query("update books.users set role='admin' where id=$1",[id]));assert.equal((await call('/admin/overview','GET',null,login.token)).status,200);
  assert.equal((await call('/auth/logout','POST',{},login.token)).status,200);assert.equal((await call('/me','GET',null,login.token)).status,401);
 }finally{child.kill();if(id)await store.tx(c=>c.query('delete from books.users where id=$1',[id]));await store.pool.end()}
});
