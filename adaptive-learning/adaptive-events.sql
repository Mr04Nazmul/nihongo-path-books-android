-- Draft migration for staging. Existing Books session tokens are opaque; the
-- Edge function must hash them before passing the hash to this service-only RPC.
begin;

create table books.adaptive_events (
  owner_id uuid not null references books.users(id) on delete cascade,
  event_id uuid not null,
  cursor_id bigint generated always as identity,
  occurred_at timestamptz not null,
  event jsonb not null check (jsonb_typeof(event) = 'object' and octet_length(event::text) <= 2048),
  primary key (owner_id, event_id),
  unique (owner_id, cursor_id)
);

alter table books.adaptive_events enable row level security;
revoke all on books.adaptive_events from public, anon, authenticated;

create function public.nihongo_adaptive_sync(token_hash text, after_cursor bigint, events jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  owner uuid;
  payload jsonb;
begin
  select user_id into owner from books.sessions
    where books.sessions.token_hash = nihongo_adaptive_sync.token_hash and expires_at > now();
  if owner is null then return '{"status":401,"error":"Please sign in"}'; end if;

  if jsonb_typeof(events) is distinct from 'array' or octet_length(events::text) > 65536 then
    return '{"status":400,"error":"Invalid event batch"}';
  end if;
  if jsonb_array_length(events) > 32 or after_cursor is null or after_cursor < 0 then
    return '{"status":400,"error":"Invalid event batch or cursor"}';
  end if;

  -- Serialize insertion and cursor assignment per owner across all devices.
  perform 1 from books.users where id = owner for no key update;
  if not found or not exists (
    select 1 from books.sessions s where s.user_id = owner
      and s.token_hash = nihongo_adaptive_sync.token_hash and s.expires_at > clock_timestamp()
  ) then return '{"status":401,"error":"Please sign in"}'; end if;
  insert into books.adaptive_events (owner_id, event_id, occurred_at, event)
  select owner, (value->>'id')::uuid, to_timestamp((value->>'at')::double precision / 1000),
    value - 'owner_id'
  from jsonb_array_elements(events)
  on conflict (owner_id, event_id) do nothing;

  select coalesce(jsonb_agg(jsonb_build_object('cursor', cursor_id::text, 'event', event)
    order by cursor_id), '[]'::jsonb) into payload
  from (
    select cursor_id, event from books.adaptive_events
    where owner_id = owner and cursor_id > after_cursor order by cursor_id limit 128
  ) page;

  return jsonb_build_object('events', payload);
exception when invalid_text_representation or not_null_violation or check_violation or datetime_field_overflow then
  return '{"status":400,"error":"Invalid adaptive event"}';
end
$$;

revoke all on function public.nihongo_adaptive_sync(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.nihongo_adaptive_sync(text, bigint, jsonb) to service_role;
commit;
