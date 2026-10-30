-- App-only bonuses; existing public.points/referral_points are never changed.
create table books.referral_codes(code text primary key,user_id uuid unique not null references books.users(id) on delete cascade);
create table books.referral_claims(identity_hash text primary key,referrer_hash text not null,level text not null default 'N5' check(level='N5'),credits integer not null default 5 check(credits=5),created_at timestamptz not null default now());
alter table books.referral_codes enable row level security;
alter table books.referral_claims enable row level security;
revoke all on books.referral_codes,books.referral_claims from public,anon,authenticated;
create policy edge_clients_denied on books.referral_codes for all to anon,authenticated using(false) with check(false);
create policy edge_clients_denied on books.referral_claims for all to anon,authenticated using(false) with check(false);
create function books.referral_api(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u books.users%rowtype;code text;owner_id uuid;identity text; n integer;
begin
 select x.* into u from books.users x join books.sessions s on s.user_id=x.id where s.token_hash=payload->>'tokenHash' and s.expires_at>now();
 if u.id is null then return '{"error":"Please sign in","status":401}';end if;
 if action='info' then
  select r.code into code from books.referral_codes r where r.user_id=u.id;
  if code is null then
   if to_regclass('public.profiles') is not null then execute 'select referral_code from public.profiles where id=$1' into code using u.id;end if;
   if code is null or code!~'^[A-Za-z0-9_-]{3,64}$' or exists(select 1 from books.referral_codes r where r.code=code) then code:='NP'||replace(gen_random_uuid()::text,'-','');end if;
   insert into books.referral_codes values(code,u.id) on conflict(user_id) do nothing;select r.code into code from books.referral_codes r where r.user_id=u.id;
  end if;
  identity:=encode(sha256(convert_to('nihongo-referral-v1:'||u.id::text,'UTF8')),'hex');
  return jsonb_build_object('code',code,'bonusLevel','N5','bonusCredits',5,'claimed',exists(select 1 from books.referral_claims where identity_hash=identity));
 elsif action='claim' then
  perform 1 from books.users where id=u.id for update;
  identity:=encode(sha256(convert_to('nihongo-referral-v1:'||u.id::text,'UTF8')),'hex');code:=trim(coalesce(payload->>'code',''));
  if exists(select 1 from books.referral_claims where identity_hash=identity) then return '{"credited":0,"reason":"already_claimed"}';end if;
  if code='' then return '{"credited":0,"reason":"no_code"}';end if;
  if code!~'^[A-Za-z0-9_-]{3,64}$' then return '{"credited":0,"reason":"invalid_code"}';end if;
  select r.user_id into owner_id from books.referral_codes r where r.code=code;
  if owner_id is null and to_regclass('public.profiles') is not null then execute 'select id from public.profiles where referral_code=$1 limit 1' into owner_id using code;end if;
  if owner_id is null then return '{"credited":0,"reason":"invalid_code"}';end if;
  if owner_id=u.id then return '{"credited":0,"reason":"self_referral"}';end if;
  if u.created_at<now()-interval '24 hours' or coalesce((payload->>'authCreatedAt')::timestamptz,'epoch'::timestamptz)<now()-interval '24 hours' then return '{"credited":0,"reason":"new_accounts_only"}';end if;
  insert into books.referral_claims(identity_hash,referrer_hash) values(identity,encode(sha256(convert_to('nihongo-referral-v1:'||owner_id::text,'UTF8')),'hex')) on conflict do nothing;
  get diagnostics n=row_count;if n=0 then return '{"credited":0,"reason":"already_claimed"}';end if;
  insert into books.balances(user_id,level,credits) values(u.id,'N5',5) on conflict(user_id,level) do update set credits=books.balances.credits+5;
  insert into books.events(user_id,kind,detail) values(u.id,'referral_bonus',jsonb_build_object('level','N5','credits',5));
  return '{"credited":5,"level":"N5","reason":"granted"}';
 end if;
 return '{"error":"Unknown operation","status":404}';
end $$;
revoke all on function books.referral_api(text,jsonb) from public,anon,authenticated;
grant execute on function books.referral_api(text,jsonb) to service_role;
create function public.nihongo_books_referral_api(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select books.referral_api(action,payload)$$;
revoke all on function public.nihongo_books_referral_api(text,jsonb) from public,anon,authenticated;
grant execute on function public.nihongo_books_referral_api(text,jsonb) to service_role;
