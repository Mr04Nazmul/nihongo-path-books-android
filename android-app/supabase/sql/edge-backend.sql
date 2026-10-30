-- Apply after supabase/sql/edge-schema.sql.
-- Only service_role can call this API. No arbitrary SQL execution is provided.
create table if not exists books.api_rate (key text primary key, started_at timestamptz not null default now(), hits integer not null default 1);
alter table books.api_rate enable row level security;
revoke all on books.api_rate from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.api_rate;
create policy edge_clients_denied on books.api_rate for all to anon,authenticated using(false) with check(false);

create or replace function books.edge_api(action text, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u books.users%rowtype; t books.tiers%rowtype; ad books.ad_sessions%rowtype;
 old books.redemptions%rowtype; rr books.redemptions%rowtype;
 uid uuid; lev text; tokenhash text:=payload->>'tokenHash'; v jsonb; sec integer; cost integer;
 started timestamptz; expiry timestamptz; stamp timestamptz; n integer; identifier uuid;
begin
 if action='health' then return jsonb_build_object('ok',true,'backend','supabase-edge','release','1.2.0-test');end if;
 if action='rate' then
  insert into books.api_rate(key) values(left(payload->>'key',100)) on conflict(key) do update set hits=case when books.api_rate.started_at<now()-interval '1 minute' then 1 else books.api_rate.hits+1 end,started_at=case when books.api_rate.started_at<now()-interval '1 minute' then now() else books.api_rate.started_at end returning hits into n;
  if n>15 then return jsonb_build_object('error','Please wait a minute and try again','status',429);end if;
  return '{"ok":true}';
 end if;
 if action='login' then
  if (payload->>'sessionHash')!~'^[a-f0-9]{64}$' or not coalesce((payload->>'confirmed')::boolean,false) then return '{"error":"Verified identity required","status":403}';end if;
  insert into books.users(id,email,password_hash,name) values((payload->>'id')::uuid,payload->>'email','supabase-auth',left(coalesce(payload->>'name',''),100)) on conflict(id) do update set email=excluded.email returning * into u;
  insert into books.sessions(token_hash,user_id,expires_at) values(payload->>'sessionHash',u.id,now()+interval '30 days');
  return jsonb_build_object('user',jsonb_build_object('id',u.id,'email',u.email,'name',u.name,'role',u.role));
 end if;
 if action='cleanup_auth_fixture' then
  delete from books.users where id=(payload->>'verifiedUserId')::uuid and email like 'nihongo-ci-%@example.invalid';return '{"ok":true}';
 end if;
 if action='revoke_identity' then
  delete from books.sessions where user_id=(payload->>'verifiedUserId')::uuid;return '{"ok":true}';
 end if;
 if action='reward' then
  if exists(select 1 from books.rewards where transaction_id=payload->>'transaction_id') then return '{"duplicate":true}';end if;
  select * into ad from books.ad_sessions where id=(payload->>'custom_data')::uuid for update;
  if ad.id is null or ad.user_id<>(payload->>'user_id')::uuid or ad.level='N1' then return '{"error":"Invalid reward session","status":400}';end if;
  if ad.consumed_at is not null then
   if exists(select 1 from books.rewards where transaction_id=payload->>'transaction_id') then return '{"duplicate":true}';end if;
   return '{"error":"Reward session already used","status":400}';
  end if;
  stamp:=to_timestamp((payload->>'timestamp')::numeric/1000);
  if stamp<ad.created_at-interval '1 minute' or stamp>ad.expires_at or stamp>now()+interval '1 minute' then return '{"error":"Invalid reward timestamp","status":400}';end if;
  insert into books.rewards(transaction_id,ad_session,user_id,level,ad_unit,credits) values(payload->>'transaction_id',ad.id,ad.user_id,ad.level,payload->>'ad_unit',1) on conflict(transaction_id) do nothing;
  get diagnostics n=row_count;if n=0 then return '{"duplicate":true}';end if;
  update books.ad_sessions set consumed_at=now() where id=ad.id;
  insert into books.balances values(ad.user_id,ad.level,1) on conflict(user_id,level) do update set credits=books.balances.credits+1;
  return jsonb_build_object('credited',1,'level',ad.level);
 end if;
 select usr.* into u from books.sessions s join books.users usr on usr.id=s.user_id where s.token_hash=tokenhash and s.expires_at>now();
 if u.id is null then return '{"error":"Please sign in","status":401}';end if;
 uid:=u.id;
 if action='authenticate' then return jsonb_build_object('user',jsonb_build_object('id',u.id,'email',u.email,'name',u.name,'role',u.role));end if;
 if action='snapshot' then
  return jsonb_build_object('user',jsonb_build_object('id',u.id,'email',u.email,'name',u.name,'role',u.role),'serverTime',now(),'tiers',(select coalesce(jsonb_agg(x order by x.level desc,x.seconds),'[]') from books.tiers x),'levels',(select coalesce(jsonb_agg(x),'[]') from books.levels x),'balances',(select coalesce(jsonb_agg(x),'[]') from books.balances x where user_id=uid),'unlocks',(select coalesce(jsonb_agg(x),'[]') from books.unlocks x where user_id=uid),'rewards',(select coalesce(jsonb_agg(x),'[]') from (select * from books.rewards where user_id=uid order by created_at desc limit 100)x),'redemptions',(select coalesce(jsonb_agg(x),'[]') from (select * from books.redemptions where user_id=uid order by starts_at desc limit 100)x),'studyState',coalesce((select state from books.study_state where user_id=uid),'{}'));
 end if;
 if action='logout' then delete from books.sessions where token_hash=tokenhash;return '{"ok":true}';end if;
 if action='logout_all' then delete from books.sessions where user_id=uid;return '{"ok":true}';end if;
 if action='delete_account' then
  -- Shared Supabase identity belongs to other apps as well. Delete only this app's rows.
  delete from books.users where id=uid;return '{"ok":true,"scope":"nihongo-app-data-only"}';
 end if;
 if action='profile' then update books.users set name=left(coalesce(payload->>'name',''),100) where id=uid;return '{"ok":true}';end if;
 if action='state' then
  v:=payload->'state';if jsonb_typeof(v)<>'object' or octet_length(v::text)>150000 then return '{"error":"Invalid study state","status":400}';end if;
  insert into books.study_state values(uid,v,now()) on conflict(user_id) do update set state=excluded.state,updated_at=now();return '{"ok":true}';
 end if;
 lev:=payload->>'level';
 if action='allowed' then
  return jsonb_build_object('allowed',lev in ('N5','N4','N3','N2') and exists(select 1 from books.unlocks x join books.levels l using(level) where x.user_id=uid and x.level=lev and l.enabled and x.expires_at>now()));
 end if;
 if action in ('ad_session','redeem') then
  perform 1 from books.users where id=uid for update;
  if action='ad_session' then
   if not exists(select 1 from books.config where rewards_enabled) then return '{"error":"Rewards are paused. Credits are safe.","status":503}';end if;
   if lev not in ('N5','N4','N3','N2') or not exists(select 1 from books.levels where level=lev and enabled) then return '{"error":"Level unavailable","status":403}';end if;
   if (select count(*) from books.ad_sessions where user_id=uid and created_at>now()-interval '1 hour')>=60 then return '{"error":"Please take a break and try later","status":429}';end if;
   identifier:=gen_random_uuid();insert into books.ad_sessions(id,user_id,level,expires_at) values(identifier,uid,lev,now()+interval '2 hours');return jsonb_build_object('id',identifier,'userId',uid,'level',lev);
  end if;
  select * into old from books.redemptions where user_id=uid and request_id=(payload->>'requestId')::uuid;
  if old.id is not null then
   if old.tier_id<>payload->>'tierId' then return '{"error":"Request used for another tier","status":409}';end if;
   return to_jsonb(old);
  end if;
  select * into t from books.tiers where id=payload->>'tierId' and enabled for share;
  if t.id is null or t.level='N1' or not exists(select 1 from books.levels where level=t.level and enabled) then return '{"error":"Unlock tier unavailable","status":400}';end if;
  if exists(select 1 from books.unlocks where user_id=uid and level=t.level and expires_at>now()) then return '{"error":"Already unlocked. Existing time and credits are kept.","status":409}';end if;
  update books.balances set credits=credits-t.credits where user_id=uid and level=t.level and credits>=t.credits;
  get diagnostics n=row_count;if n=0 then return '{"error":"Not enough credits","status":409}';end if;
  started:=now();expiry:=now()+make_interval(secs=>t.seconds);
  insert into books.unlocks values(uid,t.level,expiry) on conflict(user_id,level) do update set expires_at=excluded.expires_at;
  insert into books.redemptions values(gen_random_uuid(),uid,(payload->>'requestId')::uuid,t.id,t.level,t.credits,started,expiry) returning * into rr;return to_jsonb(rr);
 end if;
 if action='event' then insert into books.events(user_id,kind,detail) values(uid,left(payload->>'kind',80),coalesce(payload->'detail','{}'));return '{"ok":true}';end if;
 if action like 'admin_%' then
  if u.role<>'admin' then return '{"error":"Administrator access required","status":403}';end if;
  if action='admin_overview' then
   return jsonb_build_object('levels',(select coalesce(jsonb_agg(x order by level desc),'[]') from books.levels x),'tiers',(select coalesce(jsonb_agg(x order by level desc,seconds),'[]') from books.tiers x),'config',(select to_jsonb(x) from books.config x limit 1),'chapters',(select coalesce(jsonb_agg(x),'[]') from books.chapters x),'audio',(select coalesce(jsonb_agg(x),'[]') from books.audio x),'balances',(select coalesce(jsonb_agg(x),'[]') from books.balances x),'unlocks',(select coalesce(jsonb_agg(x),'[]') from books.unlocks x),'redemptions',(select coalesce(jsonb_agg(x),'[]') from (select * from books.redemptions order by starts_at desc limit 100)x),'events',(select coalesce(jsonb_agg(x),'[]') from (select kind,detail,created_at from books.events order by id desc limit 100)x),'counts',jsonb_build_object('users',(select count(*) from books.users),'verified_ads',(select count(*) from books.rewards),'issued',(select coalesce(sum(credits),0) from books.rewards),'redeemed',(select coalesce(sum(credits),0) from books.redemptions),'active_unlocks',(select count(*) from books.unlocks where expires_at>now())));
  end if;
  if action='admin_level' then
   if lev='N1' and coalesce((payload->>'enabled')::boolean,false) then return '{"error":"N1 requires a future release","status":409}';end if;
   if lev not in ('N5','N4','N3','N2','N1') or jsonb_typeof(payload->'enabled')<>'boolean' then return '{"error":"Invalid level","status":400}';end if;
   update books.levels set enabled=(payload->>'enabled')::boolean,coming_soon=(lev='N1' or coalesce((payload->>'comingSoon')::boolean,false)) where level=lev;
  elsif action='admin_tier' then
   cost:=(payload->>'credits')::integer;sec:=(payload->>'seconds')::integer;
   if cost not between 1 and 1000 or sec not between 1 and 2592000 or jsonb_typeof(payload->'enabled')<>'boolean' then return '{"error":"Invalid tier","status":400}';end if;
   if payload->>'id' like 'N1-%' and (payload->>'enabled')::boolean then return '{"error":"N1 rewards disabled","status":409}';end if;
   update books.tiers set credits=cost,seconds=sec,enabled=(payload->>'enabled')::boolean where id=payload->>'id';
  elsif action='admin_config' then
   if jsonb_typeof(payload->'rewardsEnabled')<>'boolean' then return '{"error":"Invalid config","status":400}';end if;
   update books.config set rewards_enabled=(payload->>'rewardsEnabled')::boolean;
  elsif action='admin_chapter' then
   if (payload->>'id')!~'^[a-z0-9-]{1,100}$' or jsonb_typeof(payload->'entries')<>'array' or coalesce((payload->>'published')::boolean,false) then return '{"error":"Invalid draft or review required","status":400}';end if;
   insert into books.chapters(id,level,kind,title,position,entries) values(payload->>'id',lev,payload->>'kind',left(payload->>'title',200),coalesce((payload->>'position')::int,0),payload->'entries') on conflict(id) do update set title=excluded.title,position=excluded.position,entries=excluded.entries,updated_at=now();
  elsif action='admin_audio' then
   if (payload->>'id')!~'^[a-z0-9-]{1,100}$' or (payload->>'path')!~'^audio/listening/n5/[a-zA-Z0-9/_.-]+\.mp3$' or position('..' in payload->>'path')>0 or coalesce((payload->>'published')::boolean,false) then return '{"error":"Invalid audio draft or review required","status":400}';end if;
   insert into books.audio(id,path,rights) values(payload->>'id',payload->>'path',coalesce(payload->'rights','{}')) on conflict(id) do update set path=excluded.path,rights=excluded.rights;
  else return '{"error":"Unknown admin operation","status":404}';end if;
  insert into books.events(user_id,kind,detail) values(uid,action,payload-'tokenHash');return '{"ok":true}';
 end if;
 return '{"error":"Route not found","status":404}';
exception when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation then return '{"error":"Invalid request","status":400}';
end $$;
revoke all on function books.edge_api(text,jsonb) from public,anon,authenticated;
grant usage on schema books to service_role;
grant execute on function books.edge_api(text,jsonb) to service_role;
create or replace function public.nihongo_books_api(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select books.edge_api(action,payload) $$;
revoke all on function public.nihongo_books_api(text,jsonb) from public,anon,authenticated;
grant execute on function public.nihongo_books_api(text,jsonb) to service_role;
