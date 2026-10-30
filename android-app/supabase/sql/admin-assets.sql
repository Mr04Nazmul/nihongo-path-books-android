-- Private reviewed publications; editing a draft never overwrites a published snapshot.
create table if not exists books.published_chapters(id text primary key references books.chapters(id),content jsonb not null,review jsonb not null,revision integer not null default 1,updated_at timestamptz not null default now());
create table if not exists books.chapter_revisions(id uuid primary key default gen_random_uuid(),chapter_id text not null references books.chapters(id),content jsonb not null,review jsonb not null,created_by uuid,created_at timestamptz not null default now());
alter table books.audio add column if not exists storage_path text;
alter table books.audio add column if not exists lesson_id text;
alter table books.audio add column if not exists sha256 text;
alter table books.audio add column if not exists size_bytes integer;
alter table books.audio add column if not exists review jsonb not null default '{}';
alter table books.published_chapters enable row level security;
alter table books.chapter_revisions enable row level security;
revoke all on books.published_chapters,books.chapter_revisions from public,anon,authenticated;
create policy edge_clients_denied on books.published_chapters for all to anon,authenticated using(false) with check(false);
create policy edge_clients_denied on books.chapter_revisions for all to anon,authenticated using(false) with check(false);
create or replace function books.assets_api(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u books.users%rowtype;c books.chapters%rowtype;v jsonb;lev text:=payload->>'level';r jsonb:=payload->'review';identifier text:=payload->>'id';
begin
 select x.* into u from books.users x join books.sessions s on x.id=s.user_id where s.token_hash=payload->>'tokenHash' and s.expires_at>now();
 if u.id is null then return '{"error":"Please sign in","status":401}';end if;
 if action='published' then
  if lev not in ('N5','N4','N3','N2') or not exists(select 1 from books.unlocks x join books.levels l using(level) where x.user_id=u.id and x.level=lev and l.enabled and x.expires_at>now()) then return '{"error":"Unlock this level","status":403}';end if;
  return jsonb_build_object('chapters',(select coalesce(jsonb_agg(p.content order by (p.content->>'position')::int),'[]') from books.published_chapters p where p.content->>'level'=lev),'audio',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from books.audio a where lev='N5' and a.published and a.storage_path is not null));
 end if;
 if u.role<>'admin' then return '{"error":"Administrator access required","status":403}';end if;
 if action='admin_inventory' then return jsonb_build_object('publications',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'review',p.review,'revision',p.revision,'updated_at',p.updated_at)),'[]') from books.published_chapters p),'revisionHistory',(select coalesce(jsonb_agg(x),'[]') from (select chapter_id,created_by,created_at from books.chapter_revisions order by created_at desc limit 50)x));end if;
 if action='publish_chapter' then
  select * into c from books.chapters where id=identifier for update;
  if c.id is null or c.level='N1' or c.kind='listening' or jsonb_array_length(c.entries)=0 then return '{"error":"Active text chapter required","status":400}';end if;
  if coalesce(r->>'status','')<>'verified' or length(coalesce(r->>'reviewer',''))<2 or length(coalesce(r->>'notes',''))<10 or not coalesce((r->>'japaneseChecked')::boolean,false) or not coalesce((r->>'bengaliChecked')::boolean,false) or not coalesce((r->>'appDistributionRights')::boolean,false) then return '{"error":"Complete lexical and distribution-rights review before publishing","status":409}';end if;
  if (select count(*) from jsonb_array_elements(c.entries))<>(select count(distinct e->>'id') from jsonb_array_elements(c.entries)e) or exists(select 1 from jsonb_array_elements(c.entries)e where coalesce(e->>'id','')='' or coalesce(e->>'meaning','')='' or (c.kind='vocab' and (coalesce(e->>'word','')='' or coalesce(e->>'reading','')='')) or (c.kind='grammar' and (coalesce(e->>'pattern','')='' or coalesce(e->>'formation','')='' or coalesce(e->>'explanation','')='' or coalesce(e->>'pattern_reading','')='')) or (c.kind='kanji' and (coalesce(e->>'character','')='' or coalesce(jsonb_typeof(e->'onyomi'),'')<>'array' or coalesce(jsonb_typeof(e->'kunyomi'),'')<>'array'))) then return '{"error":"Each entry needs a unique ID, Bengali meaning and complete Japanese reading fields","status":409}';end if;
  v:=jsonb_build_object('id',c.id,'level',c.level,'kind',c.kind,'title',c.title,'position',c.position,'entries',c.entries);
  r:=r||jsonb_build_object('contentHash',encode(sha256(convert_to(v::text,'UTF8')),'hex'),'reviewedAt',now(),'reviewedByUser',u.id);
  insert into books.chapter_revisions(chapter_id,content,review,created_by) values(c.id,v,r,u.id);
  insert into books.published_chapters(id,content,review) values(c.id,v,r) on conflict(id) do update set content=excluded.content,review=excluded.review,revision=books.published_chapters.revision+1,updated_at=now();
 elsif action='unpublish_chapter' then
  delete from books.published_chapters where id=identifier;
 elsif action='audio_uploaded' then
  if identifier!~'^upload-[a-f0-9-]{36}$' or (payload->>'storagePath')!~'^n5/[a-f0-9-]{36}\.mp3$' or (payload->>'sha256')!~'^[a-f0-9]{64}$' or (payload->>'size')::integer not between 1 and 20000000 then return '{"error":"Invalid upload metadata","status":400}';end if;
  insert into books.audio(id,path,storage_path,sha256,size_bytes) values(identifier,'audio/listening/n5/uploads/'||substring(payload->>'storagePath' from 4),payload->>'storagePath',payload->>'sha256',(payload->>'size')::integer);
 elsif action='review_audio' then
  if coalesce((payload->>'published')::boolean,false) and (coalesce(r->>'status','')<>'verified' or length(coalesce(r->>'reviewer',''))<2 or length(coalesce(r->>'notes',''))<10 or not coalesce((payload->'rights'->>'appDistribution')::boolean,false) or not coalesce((payload->'rights'->>'audioHosting')::boolean,false) or not coalesce((payload->'rights'->>'advertising')::boolean,false) or coalesce(payload->>'lessonId','')!~'^mlc-n5-l[12]-[0-9]{2}$') then return '{"error":"Reviewed app, audio-hosting, advertising and attribution rights required","status":409}';end if;
  update books.audio set lesson_id=payload->>'lessonId',rights=coalesce(payload->'rights','{}'),review=coalesce(r,'{}'),published=coalesce((payload->>'published')::boolean,false) where id=identifier and storage_path is not null;
 else return '{"error":"Unknown asset operation","status":404}';end if;
 insert into books.events(user_id,kind,detail) values(u.id,'admin_'||action,jsonb_build_object('id',identifier));
 return '{"ok":true}';
exception when invalid_text_representation or check_violation or not_null_violation then return '{"error":"Invalid asset metadata","status":400}';
end $$;
revoke all on function books.assets_api(text,jsonb) from public,anon,authenticated;
grant execute on function books.assets_api(text,jsonb) to service_role;
create or replace function public.nihongo_books_assets_api(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select books.assets_api(action,payload) $$;
revoke all on function public.nihongo_books_assets_api(text,jsonb) from public,anon,authenticated;
grant execute on function public.nihongo_books_assets_api(text,jsonb) to service_role;
