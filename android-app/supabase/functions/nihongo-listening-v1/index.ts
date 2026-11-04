import allowed from './allowed.json' with {type:'json'};
import audioSources from './audio-sources.json' with {type:'json'};
const project=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const noStore={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...noStore,'Content-Type':'application/json'}})}
async function hash(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
const serviceHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
export async function handle(req){try{
 const u=new URL(req.url),marker='/nihongo-listening-v1',offset=u.pathname.indexOf(marker),route=offset>=0?u.pathname.slice(offset+marker.length):u.pathname;
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 if(route==='/health')return json({ok:true,files:Object.keys(allowed).length,release:'1.13.0'});
 if(!route.startsWith('/content/'))return json({error:'Not found'},404);
 const path=decodeURIComponent(route.slice(9));if(!Object.hasOwn(allowed,path)||path.includes('..'))return json({error:'Unknown asset'},404);
 const level=/^listening\/(n[1-5])\//.exec(path)?.[1].toUpperCase();if(!level)return json({error:'Unknown level'},404);
 const free=/^listening\/n[1-5]\/2012\/g[12]\//.test(path),catalogue=/^listening\/n[1-5]\/catalog\.json$/.test(path);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 let tokenHash='';
 if(!free&&!catalogue){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return json({error:'Sign in required'},401);
  tokenHash=await hash(token);
  const gate=await fetch(project+'/rest/v1/rpc/nihongo_books_api',{method:'POST',headers:serviceHeaders,body:JSON.stringify({action:'allowed',payload:{tokenHash,level}}),signal:AbortSignal.timeout(15000)});
  if(!gate.ok)return json({error:'Access verification unavailable'},503);const access=await gate.json();if(access.error||access.allowed!==true)return json({error:'Unlock this level in Reward Center'},403);
 }
 const range=req.headers.get('range');if(range&&!/^bytes=\d+-\d*$/.test(range))return json({error:'Invalid range'},416);
 if(path.endsWith('.mp3')){
  const sourceURL=audioSources[path]?.source;if(!sourceURL||!/^https:\/\/www\.jlpt\.jp\/samples\/sample(?:2012|2017|2018)\/mp3\/N[1-5]Q[1-5]\.mp3$/.test(sourceURL))return json({error:'Audio unavailable'},404);
  // A fixed source allowlist is used only after the original level entitlement check.
  const source=await fetch(sourceURL,{headers:range?{Range:range}:{},redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!source.ok)return json({error:'Audio unavailable'},source.status===416?416:503);
  const h=new Headers(noStore);h.set('Content-Type','audio/mpeg');for(const key of ['Content-Length','Content-Range','Accept-Ranges']){const v=source.headers.get(key);if(v)h.set(key,v)}
  return new Response(source.body,{status:source.status,headers:h});
 }
 const read=await fetch(project+'/rest/v1/rpc/nihongo_listening_read',{method:'POST',headers:serviceHeaders,body:JSON.stringify({asset_path:path,token_hash:tokenHash}),signal:AbortSignal.timeout(15000)});
 if(!read.ok)return json({error:'Media unavailable'},503);const item=await read.json();if(item.error)return json({error:item.error},item.status||403);
 if(item.mime==='application/json')return json(item.payload);
 const binary=atob(item.payload.base64||'');const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{...noStore,'Content-Type':item.mime}});
 }catch(e){console.error('Listening request failed',e?.name||'Error');return json({error:'Listening service unavailable'},503)}}
Deno.serve(handle);
