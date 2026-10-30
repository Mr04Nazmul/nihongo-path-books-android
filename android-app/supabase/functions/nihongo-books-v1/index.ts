import {Fault} from './errors.ts';
import {verifyCallback} from './ssv.mjs';
import {assets} from './assets.ts';
const project=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
export async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
async function rpc(action:string,payload:Record<string,unknown>={},api='nihongo_books_api'){
 const r=await fetch(project+'/rest/v1/rpc/'+api,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){console.error('Books RPC unavailable',r.status);throw new Fault(503,'Study service unavailable. Your credits are safe.')}
 const b=await r.json();if(b.error)throw new Fault(b.status||400,b.error);return b;
}
const assetRpc=(action:string,payload:Record<string,unknown>)=>rpc(action,payload,'nihongo_books_assets_api');
async function body(req:Request){const b=await req.text();if(new TextEncoder().encode(b).length>200000)throw new Fault(413,'Request too large');try{const d=JSON.parse(b||'{}');if(!d||typeof d!=='object'||Array.isArray(d))throw Error();return d}catch{throw new Fault(400,'Invalid JSON')}}
async function auth(path:string,method:string,b:unknown){const r=await fetch(project+'/auth/v1'+path,{method,headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify(b),redirect:'error',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok){const messages:Record<string,string>={email_not_confirmed:'This account needs support. Contact support or continue with Google.',invalid_credentials:'Email or password did not match. If you used Google before, continue with Google.',over_email_send_rate_limit:'Please wait before requesting another email.'};throw new Fault(r.status>=500?503:400,messages[d.error_code||d.code]||'Sign-in could not finish. Check your details or continue with Google.');}return d}
function cleanState(s:any){if(!s||typeof s!=='object'||Array.isArray(s))throw new Fault(400,'Invalid study state');const c:any={positions:{}};for(const k of ['saved','learned']){if(s[k]&&!Array.isArray(s[k]))throw new Fault(400,'Invalid bookmarks');c[k]=(s[k]||[]).filter((v:unknown)=>typeof v==='string'&&v.length<200);if(c[k].length>2000)throw new Fault(400,'Bookmark limit reached; export your progress before clearing entries')};for(const k of ['lang','level','dark','bookMotion','readingSize'])if(['string','boolean'].includes(typeof s[k]))c[k]=s[k];for(const[k,v]of Object.entries(s.positions||{}))if(/^N[2-5]:(vocab|grammar|kanji)$/.test(k)&&Number.isInteger(v)&&Number(v)>=0&&Number(v)<100000)c.positions[k]=v;return c}
function levelOf(path:string){const m=/^(?:data\/(?:lessons-|owner-|listening-)?|pdfs\/(?:jlpt-)?|audio\/(?:listening\/)?)(n[1-5])(?:[./-])/i.exec(path);return m?.[1].toUpperCase()}
const referralRpc=(action:string,payload:Record<string,unknown>)=>rpc(action,payload,'nihongo_books_referral_api');
async function appSession(accessToken:string,referralCode='',expectedId?:string){
 const check=await fetch(project+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(15000)});
 if(!check.ok)throw new Fault(401,'Sign in again');const u=await check.json();if(expectedId&&u.id!==expectedId)throw new Fault(401,'Sign-in identity did not match');if(!u.id||!u.email_confirmed_at)throw new Fault(403,'Contact support for account help, or continue with Google');
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),tokenHash=await hash(token);
 const result=await rpc('login',{id:u.id,email:u.email,name:u.user_metadata?.name||u.user_metadata?.full_name||'',confirmed:true,sessionHash:tokenHash});
 const bonus=await referralRpc('claim',{tokenHash,code:referralCode,authCreatedAt:u.created_at});return {...result,token,bonus};
}
export async function handle(req:Request):Promise<Response>{
 try{
  const url=new URL(req.url),marker='/nihongo-books-v1',start=url.pathname.indexOf(marker),route=start>=0?url.pathname.slice(start+marker.length)||'/':url.pathname;
  if(route==='/health'&&req.method==='GET')return json(await rpc('health'));
  if(req.method==='GET'&&['/admin','/admin.js','/admin.css','/privacy','/support','/delete-account'].includes(route)){
   const file=route==='/admin'?'admin.html':route.slice(1)+(route.includes('.')?'':'.html');return new Response(assets[file],{headers:{...headers,'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'"}});
  }
  if(route==='/ssv'&&req.method==='GET'){
   let p;try{p=await verifyCallback(url.search.slice(1),(Deno.env.get('ADMOB_ALLOWED_UNITS')||'ca-app-pub-3940256099942544/5224354917,ca-app-pub-3728341118830943/5055001578').split(','));}catch(e){const q=url.searchParams;console.warn('SSV_DIAGNOSTIC',JSON.stringify({unit:q.get('ad_unit'),userLength:q.get('user_id')?.length,customLength:q.get('custom_data')?.length,key:q.get('key_id'),reason:e instanceof Error?e.message:'unknown'}));throw e}
   if(p.verificationProbe)return json({verified:true,test:true,credited:0});return json(await rpc('reward',p));
  }
  if(route==='/auth/google/start'&&req.method==='POST'){
   await rpc('rate',{key:await hash(req.headers.get('x-forwarded-for')||'unknown')});
   const b=await body(req),challenge=String(b.challenge||''),flow=String(b.flow||'');if(!/^[\w-]{43}$/.test(challenge)||!/^[a-f0-9-]{36}$/.test(flow))throw new Fault(400,'Invalid sign-in request');
   const redirect='nihongopathbooks://auth/callback?flow='+flow;
   return json({url:project+'/auth/v1/authorize?provider=google&code_challenge_method=s256&code_challenge='+encodeURIComponent(challenge)+'&redirect_to='+encodeURIComponent(redirect)});
  }
  if(route==='/auth/exchange'&&req.method==='POST'){
   await rpc('rate',{key:await hash(req.headers.get('x-forwarded-for')||'unknown')});
   const b=await body(req);if(!/^[\w.-]{10,2048}$/.test(String(b.code||''))||!/^[\w~-]{43,128}$/.test(String(b.verifier||'')))throw new Fault(400,'Invalid sign-in callback');
   const d=await auth('/token?grant_type=pkce','POST',{auth_code:b.code,code_verifier:b.verifier});return json(await appSession(d.access_token,String(b.referralCode||'')));
  }
  if(['/auth/register','/auth/login','/auth/recover','/auth/reset-password','/auth/resend'].includes(route)&&req.method==='POST'){
   const ip=req.headers.get('x-forwarded-for')||'unknown';await rpc('rate',{key:await hash(ip)});const b=await body(req),email=String(b.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Fault(400,'Use a valid email');
   if(['/auth/recover','/auth/reset-password','/auth/resend'].includes(route))throw new Fault(410,'Password help: contact support. This app does not send confirmation or recovery emails.');
   const password=String(b.password||'');if(password.length<(route.endsWith('register')?10:1)||password.length>128)throw new Fault(400,'New accounts need a 10–128 character password');
   let createdId:string|undefined;
   if(route==='/auth/register'){
    // Explicit app policy: create only NEW identities; never confirm or overwrite an existing account.
    // Admin createUser does not send confirmation mail. Supabase Auth hashes the password.
    const created=await fetch(project+'/auth/v1/admin/users',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name:String(b.name||'').slice(0,100)},app_metadata:{books_registration:'direct_no_email_confirmation'}}),signal:AbortSignal.timeout(15000)});
    const record=await created.json();if(!created.ok)throw new Fault(created.status>=500?503:409,'Account could not be created. If this email is already registered, sign in or contact support.');
    createdId=record.id;if(!createdId)throw new Fault(503,'Account could not be created. Contact support.');
   }
   const d=await auth('/token?grant_type=password','POST',{email,password});
   if(!d.access_token)throw new Fault(503,'Sign-in could not finish. Contact support.');
   return json(await appSession(d.access_token,String(b.referralCode||''),createdId));
  }
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';if(!/^[\w-]{43}$/.test(token))throw new Fault(401,'Please sign in');const tokenHash=await hash(token);
  const me=await rpc('authenticate',{tokenHash});
  if(route==='/admin/auth-self-test'&&req.method==='POST'){
   if(me.user.role!=='admin')throw new Fault(403,'Administrator access required');
   const email='nihongo-ci-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+crypto.randomUUID();let createdId:string|null=null,testToken:string|null=null;let passed=false;
   const privileged={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
   try{
    const created=await fetch(project+'/auth/v1/admin/users',{method:'POST',headers:privileged,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name:'Disposable Nihongo integration check'}}),signal:AbortSignal.timeout(15000)});
    if(!created.ok)throw new Fault(503,'Disposable Auth test account could not be created');const record=await created.json();createdId=record.id;if(!createdId)throw new Fault(503,'Auth test identity missing');
    const loginResponse=await handle(new Request(url.origin+url.pathname.replace(/\/admin\/auth-self-test$/,'/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}));
    if(!loginResponse.ok)throw new Fault(503,'Supabase password sign-in self-test failed');const session=await loginResponse.json();testToken=session.token;
    const check=await rpc('snapshot',{tokenHash:await hash(testToken!)});if(check.user.id!==createdId||check.user.role!=='student'||check.balances.length!==0)throw new Fault(503,'App identity isolation self-test failed');passed=true;
   }finally{
    if(testToken)await rpc('delete_account',{tokenHash:await hash(testToken)});
    if(createdId){await rpc('cleanup_auth_fixture',{verifiedUserId:createdId});const removed=await fetch(project+'/auth/v1/admin/users/'+encodeURIComponent(createdId),{method:'DELETE',headers:privileged,signal:AbortSignal.timeout(15000)});if(!removed.ok)throw new Fault(503,'Disposable Auth fixture cleanup failed; administrator action required')}
   }
   await rpc('event',{tokenHash,kind:'admin_auth_self_test',detail:{passed}});return json({ok:passed,supabasePasswordLogin:passed,appSession:passed,fixtureCleanup:true});
  }
  if(route==='/referrals'&&req.method==='GET')return json(await referralRpc('info',{tokenHash}));
  if(route==='/me'&&req.method==='GET')return json(await rpc('snapshot',{tokenHash}));
  if(route==='/admin/overview'&&req.method==='GET')return json({...await rpc('admin_overview',{tokenHash}),...await assetRpc('admin_inventory',{tokenHash})});
  const assetRoutes:Record<string,string>={'/admin/publish-chapter':'publish_chapter','/admin/unpublish-chapter':'unpublish_chapter','/admin/review-audio':'review_audio'};
  if(assetRoutes[route]&&req.method==='POST')return json(await assetRpc(assetRoutes[route],{...await body(req),tokenHash}));
  if(route==='/admin/audio-upload'&&req.method==='POST'){
   if(me.user.role!=='admin')throw new Fault(403,'Administrator access required');
   if(req.headers.get('Content-Type')?.split(';')[0]!=='audio/mpeg')throw new Fault(400,'Choose an MP3 audio file');
   if(Number(req.headers.get('Content-Length')||0)>20000000)throw new Fault(413,'Audio exceeds 20 MB');
   const reader=req.body?.getReader();if(!reader)throw new Fault(400,'Audio is empty');const parts:Uint8Array[]=[];let size=0;
   for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>20000000){await reader.cancel();throw new Fault(413,'Audio exceeds 20 MB')}parts.push(value)}
   if(size<4)throw new Fault(400,'Audio is empty');const audio=new Uint8Array(size);let offset=0;for(const p of parts){audio.set(p,offset);offset+=p.length}
   if(!(audio[0]===73&&audio[1]===68&&audio[2]===51)&&!(audio[0]===255&&(audio[1]&224)===224))throw new Fault(400,'The file is not MP3 audio');
   const key=crypto.randomUUID(),storagePath='n5/'+key+'.mp3',storageHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'audio/mpeg','x-upsert':'false'};
   const uploaded=await fetch(project+'/storage/v1/object/nihongo-books-audio/'+storagePath,{method:'POST',headers:storageHeaders,body:audio,signal:AbortSignal.timeout(45000)});if(!uploaded.ok)throw new Fault(503,'Private audio upload failed');
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',audio))].map(n=>n.toString(16).padStart(2,'0')).join('');
   try{await assetRpc('audio_uploaded',{tokenHash,id:'upload-'+key,storagePath,sha256:digest,size})}catch(e){await fetch(project+'/storage/v1/object/nihongo-books-audio',{method:'DELETE',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[storagePath]})});throw e}
   return json({ok:true,id:'upload-'+key,path:'audio/listening/n5/uploads/'+key+'.mp3',bytes:size,sha256:digest,published:false});
  }
  const mapped:Record<string,[string,string]>={'/auth/logout':['POST','logout'],'/auth/logout-all':['POST','logout_all'],'/account':['DELETE','delete_account'],'/profile':['PATCH','profile'],'/study-state':['PUT','state'],'/ads/session':['POST','ad_session'],'/redeem':['POST','redeem'],'/admin/overview':['GET','admin_overview'],'/admin/level':['PATCH','admin_level'],'/admin/tier':['PATCH','admin_tier'],'/admin/config':['PATCH','admin_config'],'/admin/chapter':['PUT','admin_chapter'],'/admin/audio':['PUT','admin_audio']};
  if(mapped[route]&&mapped[route][0]===req.method){
   const b=req.method==='GET'?{}:await body(req);if(mapped[route][1]==='state')b.state=cleanState(b.state);
   if(route==='/redeem'&&!/^[a-f0-9-]{36}$/i.test(b.requestId||''))throw new Fault(400,'Valid request ID required');
   return json(await rpc(mapped[route][1],{...b,tokenHash}));
  }
  if(route.startsWith('/content/')&&req.method==='GET'){
   const path=decodeURIComponent(route.slice(9));if(!/^[\w/.-]+$/.test(path)||path.includes('..')||path.includes('\\'))throw new Fault(400,'Invalid path');const level=levelOf(path);
   if(!level||level==='N1'||(/^(audio\/|data\/listening-)/.test(path)&&level!=='N5'))throw new Fault(403,'Unavailable in this release');
   const allowed=await rpc('allowed',{tokenHash,level});if(!allowed.allowed)throw new Fault(403,'Unlock this level in the Reward Center');
   const publications=(path.startsWith('data/lessons-')||path==='data/listening-n5.json'||path.startsWith('audio/listening/n5/uploads/'))?await assetRpc('published',{tokenHash,level}):null;
   if(path.startsWith('audio/listening/n5/uploads/')){
    const item=publications.audio.find((a:any)=>a.path===path);if(!item)throw new Fault(403,'This audio has not been reviewed for publication');
    const audio=await fetch(project+'/storage/v1/object/nihongo-books-audio/'+item.storage_path,{headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(45000)});if(!audio.ok)throw new Fault(404,'Audio unavailable');return new Response(audio.body,{headers:{...headers,'Content-Type':'audio/mpeg','Accept-Ranges':'none'}});
   }
   const source=await fetch('https://devnazu.online/'+path,{redirect:'error',signal:AbortSignal.timeout(45000)});
   if(!source.ok)throw new Fault(source.status===404?404:503,'This material is unavailable');
   if(Number(source.headers.get('content-length')||0)>20000000){await source.body?.cancel();throw new Fault(413,'Material too large')}
   await rpc('event',{tokenHash,kind:'content_open',detail:{level}});
   if(publications){
    const content=await source.json();
    if(path==='data/listening-n5.json'){for(const a of publications.audio){const lesson=content.lessons?.find((e:any)=>e.id===a.lesson_id);if(lesson){lesson.audio=a.path;lesson.sha256=a.sha256;lesson.availability='available';lesson.reviewStatus='Administrator-reviewed uploaded audio'}}}
    else for(const c of publications.chapters){if(!Array.isArray(content[c.kind]))continue;const entries=new Map(content[c.kind].map((e:any)=>[e.id,e]));for(const e of c.entries)entries.set(e.id,{...e,level,source_type:'owner-text',chapter_id:c.id,chapter_title:c.title});content[c.kind]=[...entries.values()]}
    return json(content);
   }
   return new Response(source.body,{headers:{...headers,'Content-Type':source.headers.get('content-type')||'application/octet-stream','Accept-Ranges':'none'}});
  }
  throw new Fault(404,'Route not found');
 }catch(e){if(e instanceof Fault)return json({error:e.message},e.status);console.error('Books edge error',e instanceof Error?e.name:'unknown');return json({error:'Service unavailable. Your credits are safe.'},503)}
}
Deno.serve(handle);
