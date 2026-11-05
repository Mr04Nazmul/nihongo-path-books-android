import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {PACKAGE,PRODUCT,entitlement} from './policy.mjs';
const root=Deno.env.get('SUPABASE_URL')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
const mode=()=>Deno.env.get('BOOKS_PLAY_MODE')||'disabled';
const json=(b:unknown,status=200)=>new Response(JSON.stringify(b),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function rpc(action:string,payload:Record<string,unknown>={},name='nihongo_books_play_api'){
 const r=await fetch(root+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Billing database unavailable');const d=await r.json();if(d.error)throw Error(d.error);return d;
}
const b64=(s:string)=>btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
let cached={token:'',until:0};
async function googleToken(){
 if(cached.until>Date.now())return cached.token;
 const raw=Deno.env.get('BOOKS_PLAY_SERVICE_ACCOUNT');if(!raw)throw Error('Google Play verification credentials are not configured');
 const sa=JSON.parse(raw),now=Math.floor(Date.now()/1000);
 const data=b64(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+b64(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500}));
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=b64(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(data)))));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:data+'.'+signature}),signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok||!d.access_token)throw Error('Google Play authorization failed');cached={token:d.access_token,until:Date.now()+3000000};return cached.token;
}
const api='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases';
async function google(path:string,method='GET'){
 const r=await fetch(api+path,{method,headers:{Authorization:'Bearer '+await googleToken(),'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Google Play verification unavailable ('+r.status+')');return r.status===204?{}:await r.json();
}
async function verify(token:string,owner:string){
 if(token.length<10||token.length>5000)throw Error('Invalid purchase token');
 const digest=await hash(token),lease=crypto.randomUUID();
 await rpc('lock',{digest,lease});
 try{
  const p=await google('/subscriptionsv2/tokens/'+encodeURIComponent(token));
  const e=entitlement(p,owner,mode());
  // Persist only authoritative Google state. No client price, expiry or acknowledgement is trusted.
  await rpc('record',{digest,lease,owner,token,...e,linkedDigest:p.linkedPurchaseToken?await hash(p.linkedPurchaseToken):null});
  if(e.active&&p.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING')await google('/subscriptions/'+PRODUCT+'/tokens/'+encodeURIComponent(token)+':acknowledge','POST');
  return e;
 }finally{await rpc('unlock',{digest,lease})}
}
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
async function pushIdentity(req:Request){
 const audience=Deno.env.get('BOOKS_PLAY_RTDN_AUDIENCE'),email=Deno.env.get('BOOKS_PLAY_RTDN_EMAIL');
 if(!audience||!email)throw Error('RTDN identity is not configured');
 const {payload}=await jwtVerify((req.headers.get('Authorization')||'').replace(/^Bearer /,''),jwks,{issuer:['https://accounts.google.com','accounts.google.com'],audience,algorithms:['RS256']});
 if(payload.email!==email||payload.email_verified!==true)throw Error('Invalid RTDN identity');
}
async function reconcile(){
 // Keyset pagination keeps expired/on-hold subscriptions eligible for recovery checks.
 let cursor='';let count=0;
 for(;;){const rows=await rpc('list',{cursor});if(!rows.length)break;
  for(const row of rows){await verify(row.token,row.owner);cursor=row.digest;count++}
 }
 // Catch revocations and refunds if a push was missed. 30-day list is Google's maximum window.
 let page='';const start=Date.now()-29*86400000;
 do{const d=await google('/voidedpurchases?type=1&startTime='+start+(page?'&token='+encodeURIComponent(page):''));
  for(const p of d.voidedPurchases||[])if(p.purchaseToken)await rpc('void',{digest:await hash(p.purchaseToken)});
  page=d.tokenPagination?.nextPageToken||'';
 }while(page);
 return count;
}
Deno.serve(async(req:Request)=>{try{
 const path=new URL(req.url).pathname.split('/nihongo-play-billing')[1]||'/';
 if(path==='/health')return json({ok:true,mode:mode(),credentialsConfigured:!!Deno.env.get('BOOKS_PLAY_SERVICE_ACCOUNT')});
 if(req.method!=='POST')return json({error:'POST required'},405);
 if(mode()==='disabled')return json({error:'Billing setup is pending. Purchases are disabled.'},503);
 if(path==='/reconcile'){
  const expected=Deno.env.get('BOOKS_PLAY_CRON_SECRET');const supplied=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
  if(!expected||await hash(expected)!==await hash(supplied))return json({error:'Unauthorized'},401);
  return json({checked:await reconcile()});
 }
 const raw=await req.text();if(raw.length>20000)return json({error:'Request too large'},413);const b=JSON.parse(raw||'{}');
 if(path==='/rtdn'){
  await pushIdentity(req);
  const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b.message?.data||''),c=>c.charCodeAt(0))));
  if(data.packageName!==PACKAGE)return json({error:'Wrong package'},400);
  if(data.testNotification)return json({ok:true,test:true});
  const token=data.subscriptionNotification?.purchaseToken||data.voidedPurchaseNotification?.purchaseToken;
  if(!token)return json({ok:true,ignored:true});
  const row=await rpc('find',{digest:await hash(token)});
  if(row.owner)await verify(token,row.owner); // RTDN is a signal; re-fetch Google state, never grant from its body.
  if(data.voidedPurchaseNotification)await reconcile();
  return json({ok:true});
 }
 const auth=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!/^[\w-]{43}$/.test(auth))return json({error:'Sign in required'},401);
 const tokenHash=await hash(auth),me=await rpc('authenticate',{tokenHash},'nihongo_books_api');
 await rpc('rate',{key:'billing:'+me.user.id},'nihongo_books_api');
 if(path==='/status')return json(await rpc('status',{owner:me.user.id}));
 if(path==='/verify'){
  const result=await verify(String(b.purchaseToken||''),me.user.id);
  return json({ok:true,...result});
 }
 return json({error:'Not found'},404);
}catch(_e){ // Never log Google tokens, service credentials or purchase payloads.
 return json({error:'Purchase verification could not finish. No unverified access was granted. Please restore purchases later.'},503);
}});
