import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import{readFile}from'node:fs/promises';import{randomUUID,createHash}from'node:crypto';
test('Invitation bonus: five N5 credits once, existing shared code reuse, no self-referral or repeat after deletion',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;');for(const f of ['edge-schema.sql','edge-backend.sql','referrals.sql'])await db.exec(await readFile(new URL('../../supabase/sql/'+f,import.meta.url),'utf8'));
 await db.exec('create table public.profiles(id uuid primary key,referral_code text,points bigint default 0)');
 const owner=randomUUID(),student=randomUUID(),old=randomUUID(),hash=s=>createHash('sha256').update(s).digest('hex');
 for(const id of[owner,student,old]){await db.query("insert into books.users(id,email,password_hash)values($1,$2,'fixture')",[id,id+'@example.test']);await db.query("insert into books.sessions(token_hash,user_id,expires_at)values($1,$2,now()+interval '1 hour')",[hash(id),id]);}
 await db.query("insert into public.profiles(id,referral_code,points)values($1,'MY-OLD-CODE',123)",[owner]);
 const api=async(action,id,extra={})=>(await db.query('select public.nihongo_books_referral_api($1,$2) data',[action,{tokenHash:hash(id),authCreatedAt:new Date().toISOString(),...extra}])).rows[0].data;
 assert.equal((await api('info',owner)).code,'MY-OLD-CODE');assert.equal((await api('claim',owner,{code:'MY-OLD-CODE'})).reason,'self_referral');assert.equal((await api('claim',student,{code:'wrong'})).credited,0);
 const attempts=await Promise.all([api('claim',student,{code:'MY-OLD-CODE'}),api('claim',student,{code:'MY-OLD-CODE'})]);assert.equal(attempts.reduce((n,x)=>n+x.credited,0),5);
 assert.equal((await db.query('select credits from books.balances where user_id=$1 and level=\'N5\'',[student])).rows[0].credits,5);assert.equal((await db.query('select points from public.profiles where id=$1',[owner])).rows[0].points,123);
 assert.equal((await api('claim',old,{code:'MY-OLD-CODE',authCreatedAt:'2020-01-01T00:00:00Z'})).reason,'new_accounts_only');
 await db.query('delete from books.users where id=$1',[student]);await db.query("insert into books.users(id,email,password_hash)values($1,$2,'fixture')",[student,student+'@example.test']);await db.query("insert into books.sessions(token_hash,user_id,expires_at)values($1,$2,now()+interval '1 hour')",[hash(student),student]);assert.equal((await api('claim',student,{code:'MY-OLD-CODE'})).reason,'already_claimed');
 await db.exec('set role anon');await assert.rejects(()=>db.query("select public.nihongo_books_referral_api('claim','{}')"));await db.exec('reset role');
 }finally{await db.close()}
});
