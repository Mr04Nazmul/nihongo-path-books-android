begin;
create schema if not exists books;
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
-- Runtime uses a restricted NOLOGIN role in each transaction, never a client DB connection.
do $$ begin
 if not exists(select from pg_roles where rolname='books_app') then create role books_app nologin; end if;
 if not exists(select from pg_roles where rolname='books_service') then create role books_service nologin; end if;
end $$;
grant books_app, books_service to current_user;
grant usage on schema books to books_app,books_service;
grant all on all tables in schema books to books_service;
grant usage,select on all sequences in schema books to books_service;
grant select on books.tiers,books.config to books_app;
grant select on books.balances,books.unlocks,books.rewards,books.redemptions to books_app;
-- All writes, including redemption, happen in authenticated server transactions under books_service.
do $$ declare t text; begin
 foreach t in array array['balances','unlocks','rewards','redemptions'] loop
 execute format('alter table books.%I enable row level security',t);
 execute format('alter table books.%I force row level security',t);
 execute format('drop policy if exists own_rows on books.%I',t);
 execute format('create policy own_rows on books.%I for select to books_app using (user_id::text=current_setting(''books.user_id'',true))',t);
 execute format('drop policy if exists server_rows on books.%I',t);
 execute format('create policy server_rows on books.%I to books_service using(true) with check(true)',t);
 end loop;
end $$;
create index if not exists sessions_user_idx on books.sessions(user_id);
create index if not exists ads_user_time_idx on books.ad_sessions(user_id,created_at);
create index if not exists events_time_idx on books.events(created_at);
commit;
-- Defense in depth for authentication and administrative tables as well.
begin;
do $$ declare t text; begin
 foreach t in array array['users','sessions','ad_sessions','events','config','tiers'] loop
 execute format('alter table books.%I enable row level security',t);
 execute format('alter table books.%I force row level security',t);
 execute format('drop policy if exists server_only on books.%I',t);
 execute format('create policy server_only on books.%I to books_service using(true) with check(true)',t);
 end loop;
end $$;
drop policy if exists public_catalog on books.tiers;
create policy public_catalog on books.tiers for select to books_app using(true);
drop policy if exists public_config on books.config;
create policy public_config on books.config for select to books_app using(true);
revoke all on schema books from public;
commit;
