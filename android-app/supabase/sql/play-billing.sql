-- DRAFT: review and apply before enabling BOOKS_PLAY_MODE=test. Never activate live without owner approval.
begin;
create table books.play_subscriptions (
 digest text primary key check(digest ~ '^[a-f0-9]{64}$'), owner uuid,
 token text, state text not null default 'UNVERIFIED', expires_at timestamptz,
 auto_renewing boolean not null default false, is_test boolean not null default false,
 verified_at timestamptz, revoked boolean not null default false,
 lease uuid, lease_until timestamptz
);
alter table books.play_subscriptions enable row level security;
revoke all on books.play_subscriptions from public,anon,authenticated;
create index on books.play_subscriptions(owner,expires_at);
create function books.play_expiry(uid uuid) returns timestamptz language sql stable security definer set search_path='' as $$
 select max(expires_at) from books.play_subscriptions where owner=uid and not revoked
 and state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED')
 and expires_at>now() and verified_at>now()-interval '20 minutes'
$$;
revoke all on function books.play_expiry(uuid) from public,anon,authenticated;
create function public.nihongo_books_play_api(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d text:=payload->>'digest'; row books.play_subscriptions%rowtype; r jsonb;
begin
 if action='lock' then
  insert into books.play_subscriptions(digest) values(d) on conflict do nothing;
  update books.play_subscriptions set lease=(payload->>'lease')::uuid,lease_until=now()+interval '60 seconds'
   where digest=d and (lease_until is null or lease_until<now());
  if not found then return '{"error":"Verification already in progress"}';end if;
  return '{"ok":true}';
 elsif action='unlock' then
  update books.play_subscriptions set lease=null,lease_until=null where digest=d and lease=(payload->>'lease')::uuid;
  return '{"ok":true}';
 elsif action='record' then
  select * into row from books.play_subscriptions where digest=d for update;
  if row.lease is distinct from (payload->>'lease')::uuid or row.lease_until<now() then return '{"error":"Verification lease expired"}';end if;
  if row.owner is not null and row.owner<>(payload->>'owner')::uuid then return '{"error":"Purchase already belongs to another account"}';end if;
  update books.play_subscriptions set owner=(payload->>'owner')::uuid,token=payload->>'token',state=payload->>'state',
   expires_at=(payload->>'expiresAt')::timestamptz,auto_renewing=(payload->>'autoRenewing')::boolean,
   is_test=(payload->>'test')::boolean,verified_at=now() where digest=d;
  -- Replacement tokens must not leave the old purchase usable separately.
  if payload->>'linkedDigest' is not null then
   update books.play_subscriptions set revoked=true where digest=payload->>'linkedDigest' and owner=(payload->>'owner')::uuid;
  end if;
  return '{"ok":true}';
 elsif action='void' then
  update books.play_subscriptions set revoked=true,state='VOIDED',expires_at=now(),verified_at=now() where digest=d;
  return '{"ok":true}';
 elsif action='find' then
  select jsonb_build_object('owner',owner) into r from books.play_subscriptions where digest=d;
  return coalesce(r,'{}');
 elsif action='list' then
  return (select coalesce(jsonb_agg(x),'[]') from (select digest,owner,token from books.play_subscriptions
   where token is not null and not revoked and digest>coalesce(payload->>'cursor','') order by digest limit 100)x);
 elsif action='status' then
  return jsonb_build_object('premiumUntil',books.play_expiry((payload->>'owner')::uuid),'subscriptions',
   (select coalesce(jsonb_agg(jsonb_build_object('state',state,'expiresAt',expires_at,'autoRenewing',auto_renewing)),'[]')
    from books.play_subscriptions where owner=(payload->>'owner')::uuid and not revoked));
 end if;
 return '{"error":"Unknown billing action"}';
end $$;
revoke all on function public.nihongo_books_play_api(text,jsonb) from public,anon,authenticated;
grant execute on function public.nihongo_books_play_api(text,jsonb) to service_role;
-- Patch only the two entitlement read paths; preserve all existing reward/manual grants and account behavior.
do $patch$
declare src text; original text;
begin
 select pg_get_functiondef('books.edge_api(text,jsonb)'::regprocedure) into original;
 src:=replace(original,
 '''unlocks'',(select coalesce(jsonb_agg(x),''[]'') from books.unlocks x where user_id=uid)',
 '''unlocks'',(select coalesce(jsonb_agg(x),''[]'') from (select uid as user_id,l.level,greatest(coalesce(u.expires_at,''epoch''::timestamptz),coalesce(books.play_expiry(uid),''epoch''::timestamptz)) as expires_at from books.levels l left join books.unlocks u on u.level=l.level and u.user_id=uid where l.enabled)x)');
 if src=original then raise exception 'Snapshot hook changed; review the live edge_api before applying';end if;
 original:=src;
 src:=replace(src,
 'lev in (''N5'',''N4'',''N3'',''N2'',''N1'') and exists(select 1 from books.unlocks x join books.levels l using(level) where x.user_id=uid and x.level=lev and l.enabled and x.expires_at>now())',
 'lev in (''N5'',''N4'',''N3'',''N2'',''N1'') and exists(select 1 from books.levels l where l.level=lev and l.enabled and (books.play_expiry(uid)>now() or exists(select 1 from books.unlocks x where x.user_id=uid and x.level=lev and x.expires_at>now())))');
 if src=original then raise exception 'Content authorization hook changed; review live edge_api';end if;
 execute src;
end $patch$;
commit;
