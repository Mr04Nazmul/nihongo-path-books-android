import test from 'node:test';import assert from 'node:assert/strict';
import {supabaseAuth} from '../src/supabase-auth.mjs';
import {protectedFile} from '../src/content.mjs';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test'};
test('Supabase requires confirmed identity; signup without session does not issue app token',async()=>{
 const auth=supabaseAuth(env,async()=>({ok:true,json:async()=>({user:{id:'unconfirmed'}})}));
 await assert.rejects(auth.login({}, {email:'a@example.com',password:'long-password-123'},true),/confirm/);
});
test('Supabase ignores user-editable roles and issues only hashed opaque app session',async()=>{
 const calls=[];const transport=async(url,opts)=>{calls.push([url,opts]);return {ok:true,json:async()=>url.endsWith('/user')?{id:'user-id',email:'a@example.com',email_confirmed_at:'2026-10-29',user_metadata:{name:'Name',role:'admin'}}:{access_token:'verified-by-auth'}}};
 const queries=[];const store={tx:async f=>f({query:async(sql,values)=>{queries.push([sql,values]);return {rows:[{id:'user-id',role:'student'}]}}})};
 const r=await supabaseAuth(env,transport).login(store,{email:'a@example.com',password:'long-password-123'});
 assert.equal(r.user.role,'student');assert.equal(r.token.length,43);assert.equal(queries[1][1][0].length,64);assert.notEqual(queries[1][1][0],r.token);assert.equal(calls[1][1].headers.Authorization,'Bearer verified-by-auth');
});
test('Supabase failure and missing delete credential fail closed',async()=>{
 await assert.rejects(supabaseAuth({},fetch).login({}, {email:'a@example.com',password:'long-password-123'}),/configured/);
 await assert.rejects(supabaseAuth(env,fetch).deleteUser('x'),/configuration/);
});
test('N1 and non-N5 listening denied even if entitlement store would allow',async()=>{
 for(const path of ['data/n1.json','data/lessons-n1.json','pdfs/n1-vocab.pdf','data/listening-n4.json','audio/listening/n2/01.mp3'])await assert.rejects(protectedFile('/tmp',path,{id:'x'},{allowed:async()=>true}),/Unavailable/);
});
