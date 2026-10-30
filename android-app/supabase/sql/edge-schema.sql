-- Supabase Edge-only schema: no custom database roles or direct client table access.
create schema if not exists books;
revoke all on schema books from public,anon,authenticated;
create table if not exists books.users (
 id uuid primary key, email text unique not null, password_hash text not null,
 name text not null default '', role text not null default 'student' check(role in ('student','admin')),
 created_at timestamptz not null default now()
);
create table if not exists books.sessions (
 token_hash text primary key, user_id uuid not null references books.users(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists books.tiers (
 id text primary key, level text not null check(level in ('N5','N4','N3','N2','N1')),
 seconds integer not null check(seconds>0 and seconds<=2592000),
 credits integer not null check(credits>0 and credits<=1000), enabled boolean not null default true,
 unique(level,seconds)
);
insert into books.tiers(id,level,seconds,credits)
select level||'-'||seconds,level,seconds,credits from (
 values ('N5',2,5,10,20),('N4',3,8,12,24),('N3',4,10,16,30),('N2',5,12,20,36),('N1',6,15,25,45)
) as t(level,h5,h24,d3,d7)
cross join lateral (values (18000,h5),(86400,h24),(259200,d3),(604800,d7)) as d(seconds,credits)
on conflict do nothing;
create table if not exists books.balances (
 user_id uuid not null references books.users(id) on delete cascade,
 level text not null check(level in ('N5','N4','N3','N2','N1')),
 credits integer not null default 0 check(credits>=0), primary key(user_id,level)
);
create table if not exists books.ad_sessions (
 id uuid primary key, user_id uuid not null references books.users(id) on delete cascade,
 level text not null check(level in ('N5','N4','N3','N2','N1')),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 consumed_at timestamptz
);
create table if not exists books.rewards (
 transaction_id text primary key, ad_session uuid unique not null references books.ad_sessions(id),
 user_id uuid not null references books.users(id) on delete cascade,
 level text not null, ad_unit text not null, credits integer not null check(credits=1),
 created_at timestamptz not null default now()
);
create table if not exists books.unlocks (
 user_id uuid not null references books.users(id) on delete cascade, level text not null,
 expires_at timestamptz not null, primary key(user_id,level)
);
create table if not exists books.redemptions (
 id uuid primary key, user_id uuid not null references books.users(id) on delete cascade,
 request_id uuid not null, tier_id text not null references books.tiers(id), level text not null,
 credits integer not null, starts_at timestamptz not null, expires_at timestamptz not null,
 unique(user_id,request_id)
);
create table if not exists books.events (
 id bigint generated always as identity primary key, user_id uuid references books.users(id) on delete cascade,
 kind text not null, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists books.config (id boolean primary key default true check(id), rewards_enabled boolean not null default true);
insert into books.config(id) values(true) on conflict do nothing;
create table if not exists books.levels(level text primary key check(level in ('N5','N4','N3','N2','N1')),enabled boolean not null,coming_soon boolean not null default false);
insert into books.levels values ('N5',true,false),('N4',true,false),('N3',true,false),('N2',true,false),('N1',false,true) on conflict do nothing;
update books.tiers set enabled=false where level='N1';
create table if not exists books.study_state(user_id uuid primary key references books.users(id) on delete cascade,state jsonb not null default '{}',updated_at timestamptz not null default now());
create table if not exists books.chapters(id text primary key,level text not null references books.levels(level),kind text not null check(kind in ('vocab','grammar','kanji','listening')),position integer not null default 0,title text not null,entries jsonb not null default '[]',published boolean not null default false,updated_at timestamptz not null default now(),check(kind<>'listening' or level='N5'));
create table if not exists books.audio(id text primary key,chapter_id text references books.chapters(id),path text not null check(path like 'audio/listening/n5/%'),rights jsonb not null default '{}',published boolean not null default false);
alter table books.users enable row level security;
revoke all on books.users from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.users;
create policy edge_clients_denied on books.users for all to anon,authenticated using(false) with check(false);
alter table books.sessions enable row level security;
revoke all on books.sessions from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.sessions;
create policy edge_clients_denied on books.sessions for all to anon,authenticated using(false) with check(false);
alter table books.tiers enable row level security;
revoke all on books.tiers from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.tiers;
create policy edge_clients_denied on books.tiers for all to anon,authenticated using(false) with check(false);
alter table books.balances enable row level security;
revoke all on books.balances from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.balances;
create policy edge_clients_denied on books.balances for all to anon,authenticated using(false) with check(false);
alter table books.ad_sessions enable row level security;
revoke all on books.ad_sessions from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.ad_sessions;
create policy edge_clients_denied on books.ad_sessions for all to anon,authenticated using(false) with check(false);
alter table books.rewards enable row level security;
revoke all on books.rewards from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.rewards;
create policy edge_clients_denied on books.rewards for all to anon,authenticated using(false) with check(false);
alter table books.unlocks enable row level security;
revoke all on books.unlocks from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.unlocks;
create policy edge_clients_denied on books.unlocks for all to anon,authenticated using(false) with check(false);
alter table books.redemptions enable row level security;
revoke all on books.redemptions from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.redemptions;
create policy edge_clients_denied on books.redemptions for all to anon,authenticated using(false) with check(false);
alter table books.events enable row level security;
revoke all on books.events from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.events;
create policy edge_clients_denied on books.events for all to anon,authenticated using(false) with check(false);
alter table books.config enable row level security;
revoke all on books.config from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.config;
create policy edge_clients_denied on books.config for all to anon,authenticated using(false) with check(false);
alter table books.levels enable row level security;
revoke all on books.levels from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.levels;
create policy edge_clients_denied on books.levels for all to anon,authenticated using(false) with check(false);
alter table books.study_state enable row level security;
revoke all on books.study_state from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.study_state;
create policy edge_clients_denied on books.study_state for all to anon,authenticated using(false) with check(false);
alter table books.chapters enable row level security;
revoke all on books.chapters from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.chapters;
create policy edge_clients_denied on books.chapters for all to anon,authenticated using(false) with check(false);
alter table books.audio enable row level security;
revoke all on books.audio from public,anon,authenticated;
drop policy if exists edge_clients_denied on books.audio;
create policy edge_clients_denied on books.audio for all to anon,authenticated using(false) with check(false);
