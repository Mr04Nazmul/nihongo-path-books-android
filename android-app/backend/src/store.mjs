import pg from 'pg';
import {randomUUID} from 'node:crypto';
export const LEVELS=['N5','N4','N3','N2','N1'];
export class Fault extends Error {constructor(status,message){super(message);this.status=status}}
export function requireLevel(level){if(!LEVELS.includes(level)||level==='N1')throw new Fault(400,'Invalid level');return level}
export class Store {
 constructor(url,pool=null){this.pool=pool||new pg.Pool({connectionString:url,max:10})}
 async tx(fn,user=null){const c=await this.pool.connect();try{await c.query('begin');await c.query(user?'set local role books_app':'set local role books_service');if(user)await c.query("select set_config('books.user_id',$1,true)",[user]);const r=await fn(c);await c.query('commit');return r}catch(e){await c.query('rollback');throw e}finally{c.release()}}
 async event(user,kind,detail={}){return this.tx(c=>c.query('insert into books.events(user_id,kind,detail) values($1,$2,$3)',[user,kind,detail]))}
 async snapshot(user){return this.tx(async c=>({serverTime:new Date().toISOString(),tiers:(await c.query('select * from books.tiers order by level desc,seconds')).rows,balances:(await c.query('select * from books.balances')).rows,unlocks:(await c.query('select * from books.unlocks')).rows,rewards:(await c.query('select * from books.rewards order by created_at desc limit 100')).rows,studyState:(await c.query('select state from books.study_state where user_id=$1',[user])).rows[0]?.state||{},redemptions:(await c.query('select * from books.redemptions order by starts_at desc limit 100')).rows}),user)}
 async allowed(user,level){if(level==='N1')return false;requireLevel(level);return this.tx(async c=>(await c.query('select 1 from books.unlocks u join books.levels l using(level) where level=$1 and l.enabled and expires_at>now()',[level])).rowCount>0,user)}
 async startAd(user,level){requireLevel(level);return this.tx(async c=>{
 await c.query('select id from books.users where id=$1 for update',[user]);
 if(!(await c.query('select rewards_enabled from books.config')).rows[0]?.rewards_enabled)throw new Fault(503,'Rewards are temporarily paused. Your credits are safe.');
 const count=await c.query("select count(*)::int as n from books.ad_sessions where user_id=$1 and created_at>now()-interval '1 hour'",[user]);if(count.rows[0].n>=60)throw new Fault(429,'Please take a break and try later');
 if(!(await c.query('select 1 from books.levels where level=$1 and enabled',[level])).rowCount)throw new Fault(403,'Level unavailable');
 const id=randomUUID();await c.query("insert into books.ad_sessions(id,user_id,level,expires_at) values($1,$2,$3,now()+interval '2 hours')",[id,user,level]);return {id,userId:user,level};})}
 async reward(p){return this.tx(async c=>{
 if((await c.query('select 1 from books.rewards where transaction_id=$1',[p.transaction_id])).rowCount)return {duplicate:true};
 const ad=(await c.query('select * from books.ad_sessions where id=$1 for update',[p.custom_data])).rows[0];
 if(!ad||ad.user_id!==p.user_id)throw new Fault(400,'Invalid reward session');
 if(ad.consumed_at){if((await c.query('select 1 from books.rewards where transaction_id=$1',[p.transaction_id])).rowCount)return {duplicate:true};throw new Fault(400,'Reward session already used')}
 requireLevel(ad.level);const stamp=Number(p.timestamp);if(!Number.isFinite(stamp)||stamp<+new Date(ad.created_at)-60000||stamp>+new Date(ad.expires_at)||stamp>Date.now()+60000)throw new Fault(400,'Invalid reward timestamp');
 const r=await c.query('insert into books.rewards(transaction_id,ad_session,user_id,level,ad_unit,credits) values($1,$2,$3,$4,$5,1) on conflict(transaction_id) do nothing returning transaction_id',[p.transaction_id,ad.id,ad.user_id,ad.level,p.ad_unit]);if(!r.rowCount)return {duplicate:true};
 await c.query('update books.ad_sessions set consumed_at=now() where id=$1',[ad.id]);await c.query('insert into books.balances(user_id,level,credits) values($1,$2,1) on conflict(user_id,level) do update set credits=books.balances.credits+1',[ad.user_id,ad.level]);return {credited:1,level:ad.level};})}
 async redeem(user,tierId,requestId){return this.tx(async c=>{
 await c.query('select id from books.users where id=$1 for update',[user]);
 const prior=(await c.query('select * from books.redemptions where user_id=$1 and request_id=$2',[user,requestId])).rows[0];if(prior){if(prior.tier_id!==tierId)throw new Fault(409,'Request used for another tier');return prior}
 const tier=(await c.query('select * from books.tiers where id=$1 and enabled for share',[tierId])).rows[0];if(!tier)throw new Fault(400,'Unlock tier unavailable');requireLevel(tier.level);
 if(!(await c.query('select 1 from books.levels where level=$1 and enabled',[tier.level])).rowCount)throw new Fault(403,'Level unavailable');
 if((await c.query('select 1 from books.unlocks where user_id=$1 and level=$2 and expires_at>now()',[user,tier.level])).rowCount)throw new Fault(409,'Already unlocked. Your unused credits are kept.');
 if(!(await c.query('update books.balances set credits=credits-$3 where user_id=$1 and level=$2 and credits>=$3 returning credits',[user,tier.level,tier.credits])).rowCount)throw new Fault(409,'Not enough credits');
 const t=(await c.query("select now() as start,now()+$1*interval '1 second' as expiry",[tier.seconds])).rows[0];await c.query('insert into books.unlocks(user_id,level,expires_at) values($1,$2,$3) on conflict(user_id,level) do update set expires_at=excluded.expires_at',[user,tier.level,t.expiry]);
 return (await c.query('insert into books.redemptions(id,user_id,request_id,tier_id,level,credits,starts_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[randomUUID(),user,requestId,tier.id,tier.level,tier.credits,t.start,t.expiry])).rows[0];})}
}
