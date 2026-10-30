import {Fault} from './errors.ts';
let cache={at:0,keys:[]};
export async function googleKeys(){if(Date.now()-cache.at<3600000&&cache.keys.length)return cache.keys;const r=await fetch('https://www.gstatic.com/admob/reward/verifier-keys.json',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Fault(503,'Verification service unavailable');const d=await r.json();if(!d.keys?.length)throw new Fault(503,'No verification keys');cache={at:Date.now(),keys:d.keys};return cache.keys}
const bytes=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export function derToP1363(der){
 if(der.length<8||der[0]!==0x30||der[1]!==der.length-2||der[2]!==0x02)throw new Fault(403,'Invalid signature encoding');
 const rl=der[3],si=4+rl;if(rl<1||rl>33||der[si]!==0x02)throw new Fault(403,'Invalid signature encoding');
 const sl=der[si+1];if(sl<1||sl>33||si+2+sl!==der.length)throw new Fault(403,'Invalid signature encoding');
 const raw=new Uint8Array(64);
 for(const [start,len,offset] of [[4,rl,0],[si+2,sl,32]]){let integer=der.slice(start,start+len);if(integer[0]&0x80)throw new Fault(403,'Invalid signature integer');if(integer.length>1&&integer[0]===0){if(!(integer[1]&0x80))throw new Fault(403,'Non-canonical signature integer');integer=integer.slice(1)}if(integer.length>32)throw new Fault(403,'Invalid signature integer');raw.set(integer,offset+32-integer.length)}
 return raw;
}
export async function verifyCallback(raw,allowedUnits,provider=googleKeys){
 const m=/^(.+)&signature=([^&]+)&key_id=(\d+)$/.exec(raw);if(!m)throw new Fault(400,'Malformed callback');
 const entries=[...new URLSearchParams(raw)],p=Object.fromEntries(entries);if(new Set(entries.map(e=>e[0])).size!==entries.length)throw new Fault(400,'Duplicate parameter');
 let key=(await provider()).find(k=>String(k.keyId)===m[3]);if(!key&&provider===googleKeys){cache.at=0;key=(await provider()).find(k=>String(k.keyId)===m[3])}if(!key)throw new Fault(403,'Unknown verification key');
 const spki=bytes((key.pem||key.base64).replace(/-----[^-]+-----/g,'').replace(/\s/g,''));
 const publicKey=await crypto.subtle.importKey('spki',spki,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const signature=derToP1363(bytes(decodeURIComponent(m[2]))),encoder=new TextEncoder();
 let valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,encoder.encode(m[1]));
 if(!valid&&decodeURIComponent(m[1].replace(/\+/g,' '))!==m[1])valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,encoder.encode(decodeURIComponent(m[1].replace(/\+/g,' '))));
 if(!valid)throw new Fault(403,'Invalid signature');
 if(p.ad_unit==='1234567890')return {...p,verificationProbe:true};
 // Google documents numeric ad_unit values; accept only the exact suffix of an approved full unit.
 const approvedUnit=allowedUnits.some(unit=>unit.trim()===p.ad_unit||(/^ca-app-pub-\d{16}\/\d{10}$/.test(unit.trim())&&unit.trim().split('/')[1]===p.ad_unit));
 if(!approvedUnit||!p.transaction_id||p.transaction_id.length>256||!/^[-\w]{36}$/.test(p.custom_data||'')||!/^[-\w]{36}$/.test(p.user_id||'')||!Number.isFinite(Number(p.reward_amount))||Number(p.reward_amount)<=0)throw new Fault(400,'Unapproved reward');
 return p;
}
