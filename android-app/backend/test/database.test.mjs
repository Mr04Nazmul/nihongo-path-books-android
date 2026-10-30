import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Store} from '../src/store.mjs';import {login,authenticate} from '../src/auth.mjs';
const enabled=!!process.env.TEST_DATABASE_URL;
let embedded=null,sharedPool=null;
if(process.env.TEST_DATABASE_URL==='pglite'){
 const {PGlite}=await import('@electric-sql/pglite');const {readFile}=await import('node:fs/promises');embedded=new PGlite();await embedded.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
 await embedded.exec(await readFile(new URL('../migrations/002_android_release.sql',import.meta.url),'utf8'));
 let previous=Promise.resolve();sharedPool={async connect(){let release;const wait=previous;previous=new Promise(r=>release=r);await wait;return {query:async(sql,values)=>{const r=await embedded.query(sql,values);return {...r,rowCount:r.rows?.length||r.affectedRows||0}},release}},async end(){}};
}
function makeStore(){return new Store(process.env.TEST_DATABASE_URL,sharedPool)}
test('PostgreSQL: auth, RLS, concurrent SSV dedup, redemption, expiry and persistence',{skip:!enabled},async t=>{
 const store=makeStore();const users=[];
 try{
 const a=await login(store,{email:`${randomUUID()}@example.test`,password:'test-password-123'},true),b=await login(store,{email:`${randomUUID()}@example.test`,password:'test-password-456'},true);users.push(a.user.id,b.user.id);
 assert.equal((await authenticate(store,'Bearer '+a.token)).id,a.user.id);await assert.rejects(login(store,{email:a.user.email,password:'wrong-password-123'}));await assert.rejects(authenticate(store,'Bearer forged-token'));
 assert.equal(await store.allowed(a.user.id,'N1'),false);await assert.rejects(store.startAd(a.user.id,'N1'));await assert.rejects(store.redeem(a.user.id,'N1-18000',randomUUID()));
 assert.equal(await store.allowed(a.user.id,'N5'),false);
 await assert.rejects(store.redeem(a.user.id,'N5-18000',randomUUID()));
 const ad=await store.startAd(a.user.id,'N5'),p={custom_data:ad.id,user_id:a.user.id,transaction_id:randomUUID(),ad_unit:'test',timestamp:String(Date.now())};
 const r=await Promise.all([store.reward(p),store.reward(p),store.reward(p)]);assert.equal(r.filter(x=>x.credited).length,1);
 await assert.rejects(store.reward({...p,transaction_id:randomUUID()}));
 let snap=await store.snapshot(a.user.id);assert.equal(snap.balances[0].credits,1);assert.equal((await store.snapshot(b.user.id)).balances.length,0);
 // unfinished sessions never produce a credit
 await store.startAd(a.user.id,'N5');assert.equal((await store.snapshot(a.user.id)).balances[0].credits,1);
 for(let i=0;i<3;i++){const s=await store.startAd(a.user.id,'N5');await store.reward({...p,custom_data:s.id,transaction_id:randomUUID(),timestamp:String(Date.now())})}
 const requestId=randomUUID(),first=await store.redeem(a.user.id,'N5-18000',requestId),retry=await store.redeem(a.user.id,'N5-18000',requestId);assert.equal(first.id,retry.id);assert.equal((await store.snapshot(a.user.id)).balances[0].credits,2);assert.equal(await store.allowed(a.user.id,'N5'),true);assert.equal(await store.allowed(b.user.id,'N5'),false);
 await assert.rejects(store.redeem(a.user.id,'N5-18000',randomUUID()));assert.equal(+new Date((await store.snapshot(a.user.id)).unlocks[0].expires_at),+new Date(first.expires_at));
 await store.tx(c=>c.query("update books.unlocks set expires_at=now()-interval '1 second' where user_id=$1",[a.user.id]));assert.equal(await store.allowed(a.user.id,'N5'),false);assert.equal((await store.snapshot(a.user.id)).balances[0].credits,2);
 await store.redeem(a.user.id,'N5-18000',randomUUID());assert.equal((await store.snapshot(a.user.id)).balances[0].credits,0);
 await store.tx(c=>c.query('insert into books.study_state(user_id,state) values($1,$2)',[a.user.id,{saved:['vocab:N5:one'],positions:{'N5:vocab':4}}]));assert.equal((await store.snapshot(a.user.id)).studyState.positions['N5:vocab'],4);assert.deepEqual((await store.snapshot(b.user.id)).studyState,{});
 const secondStore=makeStore();try{assert.equal((await secondStore.snapshot(a.user.id)).redemptions.length,2)}finally{await secondStore.pool.end()}
 const stale=await store.startAd(a.user.id,'N4');await assert.rejects(store.reward({...p,custom_data:stale.id,transaction_id:randomUUID(),timestamp:'0'}));
 await store.tx(c=>c.query('update books.tiers set enabled=false where id=$1',['N4-18000']));await assert.rejects(store.redeem(a.user.id,'N4-18000',randomUUID()));await store.tx(c=>c.query('update books.tiers set enabled=true where id=$1',['N4-18000']));
 await store.tx(c=>c.query('delete from books.sessions where user_id=$1',[a.user.id]));await assert.rejects(authenticate(store,'Bearer '+a.token));
 }finally{for(const id of users)await store.tx(c=>c.query('delete from books.users where id=$1',[id]));await store.pool.end();if(embedded)await embedded.close()}
});
