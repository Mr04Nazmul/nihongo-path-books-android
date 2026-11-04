import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
test('N1 preserves verified rewards, credit prices, expiry and cross-account isolation',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 for(const file of ['edge-schema.sql','edge-backend.sql','n1-premium-release.sql'])await db.exec(await readFile(new URL('../../supabase/sql/'+file,import.meta.url),'utf8'));
 const call=async(action,payload)=>(await db.query('select public.nihongo_books_api($1,$2) as result',[action,JSON.stringify(payload)])).rows[0].result;
 const id=randomUUID(),other=randomUUID(),tokenHash='a'.repeat(64),otherHash='b'.repeat(64);
 for(const [u,h]of [[id,tokenHash],[other,otherHash]])await call('login',{id:u,email:u+'@example.invalid',confirmed:true,sessionHash:h});
 assert.equal((await call('allowed',{tokenHash,level:'N1'})).allowed,false);
 assert.equal((await call('redeem',{tokenHash,tierId:'N1-18000',requestId:randomUUID()})).status,409);
 for(let i=0;i<6;i++){const ad=await call('ad_session',{tokenHash,level:'N1'});assert(ad.id);const reward={custom_data:ad.id,user_id:id,transaction_id:randomUUID(),ad_unit:'fixture-only',timestamp:Date.now()};assert.equal((await call('reward',reward)).credited,1);assert.equal((await call('reward',reward)).duplicate,true);}
 const redemption=await call('redeem',{tokenHash,tierId:'N1-18000',requestId:randomUUID()});assert.equal(redemption.credits,6);
 assert.equal((await call('allowed',{tokenHash,level:'N1'})).allowed,true);assert.equal((await call('allowed',{tokenHash:otherHash,level:'N1'})).allowed,false);
 await db.query("update books.unlocks set expires_at=now()-interval '1 second' where user_id=$1",[id]);assert.equal((await call('allowed',{tokenHash,level:'N1'})).allowed,false);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(call('health',{}));await db.exec('reset role')}
 }finally{await db.close()}
});
