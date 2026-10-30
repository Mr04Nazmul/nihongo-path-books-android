import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const sql=await readFile(new URL('../../supabase/sql/edge-backend.sql',import.meta.url),'utf8');
test('Supabase RPC: deny public callers, app-scoped sessions, content access, rewards, expiry and admin',async()=>{
 const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;');await db.exec(await readFile(new URL('../../supabase/sql/edge-schema.sql',import.meta.url),'utf8'));await db.exec(sql);
 const call=async(action,payload={})=>(await db.query('select public.nihongo_books_api($1,$2) as result',[action,JSON.stringify(payload)])).rows[0].result;
 try{
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(call('health'));await db.exec('reset role')}
  await db.exec('set role service_role');assert.equal((await call('health')).ok,true);assert.equal((await call('snapshot',{tokenHash:'bad'})).status,401);
  const id=randomUUID(),tokenHash='a'.repeat(64),other=randomUUID(),otherHash='b'.repeat(64);
  await call('login',{id,email:id+'@example.test',confirmed:true,name:'Test',sessionHash:tokenHash});await call('login',{id:other,email:other+'@example.test',confirmed:true,sessionHash:otherHash});
  assert.equal((await call('ad_session',{tokenHash,level:'N1'})).status,403);assert.equal((await call('admin_overview',{tokenHash})).status,403);
  const base={tokenHash,level:'N5'},ad=await call('ad_session',base),reward={custom_data:ad.id,user_id:id,transaction_id:randomUUID(),ad_unit:'fixture-only',timestamp:Date.now()};
  assert.equal((await call('reward',reward)).credited,1);assert.equal((await call('reward',reward)).duplicate,true);assert.equal((await call('reward',{...reward,transaction_id:randomUUID()})).status,400);
  const ad2=await call('ad_session',base);await call('reward',{...reward,custom_data:ad2.id,transaction_id:randomUUID()});
  const redemption={tokenHash,tierId:'N5-18000',requestId:randomUUID()},r=await call('redeem',redemption);assert(r.id);assert.equal((await call('redeem',redemption)).id,r.id);assert.equal((await call('redeem',{...redemption,requestId:randomUUID()})).status,409);
  assert.equal((await call('allowed',base)).allowed,true);assert.equal((await call('allowed',{tokenHash:otherHash,level:'N5'})).allowed,false);assert.deepEqual((await call('snapshot',{tokenHash:otherHash})).balances,[]);
  await call('state',{tokenHash,state:{saved:['vocab:N5:one']}});assert.equal((await call('snapshot',{tokenHash})).studyState.saved.length,1);assert.deepEqual((await call('snapshot',{tokenHash:otherHash})).studyState,{});
  await db.exec('reset role');await db.query("update books.unlocks set expires_at=now()-interval '1 second' where user_id=$1",[id]);await db.query("update books.users set role='admin' where id=$1",[id]);await db.exec('set role service_role');
  assert.equal((await call('allowed',base)).allowed,false);assert.equal((await call('admin_level',{tokenHash,level:'N1',enabled:true})).status,409);assert.equal((await call('admin_tier',{tokenHash,id:'N1-18000',enabled:true,credits:1,seconds:18000})).status,409);
  assert.equal((await call('admin_overview',{tokenHash})).levels.length,5);
  await call('logout_all',{tokenHash});assert.equal((await call('snapshot',{tokenHash})).status,401);assert.equal((await call('snapshot',{tokenHash:otherHash})).user.id,other);
  await call('delete_account',{tokenHash:otherHash});assert.equal((await call('snapshot',{tokenHash:otherHash})).status,401);
 }finally{await db.close()}
});
