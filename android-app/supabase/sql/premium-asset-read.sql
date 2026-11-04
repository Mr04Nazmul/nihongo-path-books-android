-- Private curriculum/media store. The Android application never receives a privileged key.
create table if not exists books.premium_assets (
 path text primary key,
 level text not null references books.levels(level),
 mime text not null,
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
alter table books.premium_assets enable row level security;
revoke all on books.premium_assets from public,anon,authenticated;
grant usage on schema books to service_role;
grant select on books.premium_assets to service_role;
create or replace function public.nihongo_premium_read(asset_path text,token_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item books.premium_assets%rowtype; gate jsonb;
begin
 select * into item from books.premium_assets where path=asset_path;
 if not found then return jsonb_build_object('error','Material unavailable','status',404);end if;
 gate:=books.edge_api('allowed',jsonb_build_object('tokenHash',token_hash,'level',item.level));
 if coalesce((gate->>'allowed')::boolean,false) is not true then return jsonb_build_object('error','Unlock this level in Reward Center','status',403);end if;
 return jsonb_build_object('mime',item.mime,'payload',item.payload);
end $$;
create or replace function public.nihongo_listening_read(asset_path text,token_hash text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item books.premium_assets%rowtype; gate jsonb;
begin
 if asset_path !~ '^listening/n[1-5]/' then return jsonb_build_object('error','Unknown media','status',404);end if;
 select * into item from books.premium_assets where path=asset_path;
 if not found then return jsonb_build_object('error','Media unavailable','status',404);end if;
 if asset_path !~ '^listening/n[1-5]/(catalog[.]json|2012/g[12]/(audio[.]mp3|answers[.]json|[pq][0-9]+[.]webp))$' then
  gate:=books.edge_api('allowed',jsonb_build_object('tokenHash',token_hash,'level',item.level));
  if coalesce((gate->>'allowed')::boolean,false) is not true then return jsonb_build_object('error','Unlock this level in Reward Center','status',403);end if;
 end if;
 return jsonb_build_object('mime',item.mime,'payload',item.payload);
end $$;
revoke all on function public.nihongo_premium_read(text,text) from public,anon,authenticated;
revoke all on function public.nihongo_listening_read(text,text) from public,anon,authenticated;
grant execute on function public.nihongo_premium_read(text,text) to service_role;
grant execute on function public.nihongo_listening_read(text,text) to service_role;
