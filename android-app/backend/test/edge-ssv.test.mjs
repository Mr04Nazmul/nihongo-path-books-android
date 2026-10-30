import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';import {build} from 'esbuild';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
test('Edge WebCrypto validates DER Google-style signatures and rejects malformed or tampered rewards',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'edge-ssv-'));
 try{
  await build({entryPoints:[new URL('../../supabase/functions/nihongo-books-v1/ssv.mjs',import.meta.url).pathname],outfile:join(dir,'ssv.mjs'),bundle:true,platform:'neutral',format:'esm'});
  const {verifyCallback,derToP1363}=await import(pathToFileURL(join(dir,'ssv.mjs'))),{publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pem=publicKey.export({type:'spki',format:'pem'}),keys=async()=>[{keyId:42,pem}];
  const captured=JSON.parse(await readFile(new URL('./fixtures/google-console-ssv.json',import.meta.url),'utf8'));assert.equal((await verifyCallback(captured.query,[],async()=>[captured.key])).verificationProbe,true);
  const raw='ad_unit=test%2Funit&custom_data='+randomUUID()+'&reward_amount=1&reward_item=JLPT%20credit&timestamp='+Date.now()+'&transaction_id=test&user_id='+randomUUID();
  for(const data of [raw,decodeURIComponent(raw)]){const q=raw+'&signature='+sign('sha256',Buffer.from(data),privateKey).toString('base64url')+'&key_id=42';assert.equal((await verifyCallback(q,['test/unit'],keys)).transaction_id,'test');await assert.rejects(verifyCallback(q.replace('reward_amount=1','reward_amount=2'),['test/unit'],keys))}
  const owner='ca-app-pub-3728341118830943/5055001578';
  for(const unit of [owner,'5055001578']){
   const data=raw.replace('test%2Funit',encodeURIComponent(unit));
   const q=data+'&signature='+sign('sha256',Buffer.from(data),privateKey).toString('base64url')+'&key_id=42';
   assert.equal((await verifyCallback(q,[owner],keys)).ad_unit,unit);
  }
  const foreign=raw.replace('test%2Funit','9999999999');
  await assert.rejects(verifyCallback(foreign+'&signature='+sign('sha256',Buffer.from(foreign),privateKey).toString('base64url')+'&key_id=42',[owner],keys));
  await assert.rejects(verifyCallback(raw+'&signature=Zm9yZ2Vk&key_id=42',['test/unit'],keys));assert.throws(()=>derToP1363(Uint8Array.of(48,3,2,1,0)));
 }finally{await rm(dir,{recursive:true,force:true})}
});
