// Server-only Supabase Auth adapter. No secret enters the Android build.
import {randomBytes} from 'node:crypto';
import {Fault} from './store.mjs';
import {hashToken} from './auth.mjs';
export function supabaseAuth(env=process.env,transport=fetch){
 const base=env.SUPABASE_URL?.replace(/\/$/,'');
 async function call(path,method='GET',body=null,token=null){
  if(!base?.startsWith('https://')||!env.SUPABASE_PUBLISHABLE_KEY)throw new Fault(503,'Supabase Auth is not configured');
  const res=await transport(base+'/auth/v1'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json();if(!res.ok)throw new Fault(res.status>=500?503:400,'Authentication failed. Check email confirmation and sign-in details.');return data;
 }
 return {
  async login(store,b,register=false){
   const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<10||password.length>128)throw new Fault(400,'Use a valid email and a 10–128 character password');
   const d=await call(register?'/signup':'/token?grant_type=password','POST',{email,password,...(register?{data:{name:String(b.name||'').slice(0,100)}}:{})});
   if(!d.access_token)throw new Fault(409,'Check your email to confirm your account, then sign in.');
   const u=await call('/user','GET',null,d.access_token);
   if(!u.id||!u.email_confirmed_at)throw new Fault(403,'Confirm your email before signing in');
   const user=await store.tx(async c=>(await c.query("insert into books.users(id,email,password_hash,name) values($1,$2,'supabase-auth',$3) on conflict(id) do update set email=excluded.email returning id,email,name,role",[u.id,u.email,String(u.user_metadata?.name||'').slice(0,100)])).rows[0]);
   const token=randomBytes(32).toString('base64url');
   await store.tx(c=>c.query("insert into books.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '30 days')",[hashToken(token),u.id]));
   return {token,user};
  },
  async deleteUser(id){
   if(!env.SUPABASE_SERVICE_ROLE_KEY)throw new Fault(503,'Account deletion requires server configuration');
   const res=await transport(base+'/auth/v1/admin/users/'+encodeURIComponent(id),{method:'DELETE',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
   if(!res.ok)throw new Fault(503,'Account deletion unavailable. Please try again.');
  }
 };
}
