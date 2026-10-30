begin;
create table if not exists books.levels(level text primary key check(level in ('N5','N4','N3','N2','N1')),enabled boolean not null,coming_soon boolean not null default false);
insert into books.levels values ('N5',true,false),('N4',true,false),('N3',true,false),('N2',true,false),('N1',false,true) on conflict do nothing;
update books.tiers set enabled=false where level='N1';
create table if not exists books.study_state(user_id uuid primary key references books.users(id) on delete cascade,state jsonb not null default '{}',updated_at timestamptz not null default now());
create table if not exists books.chapters(id text primary key,level text not null references books.levels(level),kind text not null check(kind in ('vocab','grammar','kanji','listening')),position integer not null default 0,title text not null,entries jsonb not null default '[]',published boolean not null default false,updated_at timestamptz not null default now(),check(kind<>'listening' or level='N5'));
create table if not exists books.audio(id text primary key,chapter_id text references books.chapters(id),path text not null check(path like 'audio/listening/n5/%'),rights jsonb not null default '{}',published boolean not null default false);
do $$ declare t text; begin
foreach t in array array['levels','study_state','chapters','audio'] loop
execute format('alter table books.%I enable row level security',t);
execute format('alter table books.%I force row level security',t);
execute format('create policy server_rows on books.%I to books_service using(true) with check(true)',t);
end loop;end $$;
create policy catalog on books.levels for select to books_app using(true);
create policy own_rows on books.study_state for select to books_app using(user_id::text=current_setting('books.user_id',true));
grant all on books.levels,books.study_state,books.chapters,books.audio to books_service;
grant select on books.levels,books.study_state to books_app;
commit;
