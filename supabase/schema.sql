-- Open Atlas Freedom Wall: paste this entire script in Supabase > SQL Editor > Run.
-- Run on a new project. Safe to re-run for the same schema.
-- IMPORTANT: enable Authentication > Providers > Anonymous Sign-Ins.
-- Never place a Supabase secret/service_role key in public website code.

create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  display_name varchar(28) not null check (char_length(btrim(display_name)) between 2 and 28),
  body varchar(650) not null check (char_length(btrim(body)) between 2 and 650),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  country_name varchar(120) not null check (char_length(btrim(country_name)) >= 2),
  latitude numeric(6,2) not null check (latitude between -85 and 85),
  longitude numeric(6,2) not null check (longitude between -180 and 180),
  category text not null default 'thought'
    check (category in ('thought', 'confession', 'hope', 'story')),
  parent_id uuid references public.posts(id) on delete cascade,
  reaction_count integer not null default 0 check (reaction_count >= 0),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint different_parent check (parent_id is null or parent_id <> id)
);

create index if not exists posts_parent_time_idx on public.posts(parent_id, created_at desc);
create index if not exists posts_country_idx on public.posts(country_code);
create index if not exists posts_author_recent_idx on public.posts(author_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(post_id, author_id)
);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null,
  reason text not null check(reason in ('spam', 'harassment', 'hate', 'privacy', 'other')),
  created_at timestamptz not null default now(),
  unique (post_id, author_id)
);

-- Server-side rate limiting by GUEST SESSION (not by physical person).
-- For serious public traffic, also enable CAPTCHA / managed anti-abuse controls.
create or replace function public.guard_new_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.posts p
        where p.author_id = new.author_id
          and p.created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Posting too quickly. Please try again in a minute.';
  end if;
  if new.parent_id is not null then
    if not exists (select 1 from public.posts p
                   where p.id = new.parent_id and p.parent_id is null and p.hidden = false) then
      raise exception 'Replies must belong to a visible main message.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_guard_insert on public.posts;
create trigger posts_guard_insert
  before insert on public.posts
  for each row execute function public.guard_new_post();

create or replace function public.sync_reaction_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set reaction_count = reaction_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set reaction_count = greatest(0, reaction_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_count_change on public.post_likes;
create trigger post_likes_count_change
  after insert or delete on public.post_likes
  for each row execute function public.sync_reaction_count();

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_reports enable row level security;

-- Revoke direct table writes and give minimum column-level permissions.
revoke all on public.posts from anon, authenticated;
revoke all on public.post_likes from anon, authenticated;
revoke all on public.post_reports from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert (author_id, display_name, body, country_code, country_name, latitude, longitude, category, parent_id)
  on public.posts to authenticated;
grant select (post_id, author_id) on public.post_likes to authenticated;
grant insert (post_id, author_id) on public.post_likes to authenticated;
grant delete on public.post_likes to authenticated;
grant insert (post_id, author_id, reason) on public.post_reports to authenticated;

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts
  for select to anon, authenticated using (hidden = false);

drop policy if exists posts_guest_insert on public.posts;
create policy posts_guest_insert on public.posts
  for insert to authenticated with check (author_id = (select auth.uid()) and hidden = false);

drop policy if exists likes_authenticated_read on public.post_likes;
create policy likes_authenticated_read on public.post_likes
  for select to authenticated using (author_id = (select auth.uid()));

drop policy if exists likes_guest_insert on public.post_likes;
create policy likes_guest_insert on public.post_likes
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.hidden = false)
  );

drop policy if exists likes_guest_delete on public.post_likes;
create policy likes_guest_delete on public.post_likes
  for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists reports_guest_insert on public.post_reports;
create policy reports_guest_insert on public.post_reports
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.hidden = false)
  );

-- Enable a simple realtime feed. This script won't re-add an already-published table.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end;
$$;

-- Community moderation (run this manually in SQL Editor for a reported post):
-- update public.posts set hidden = true where id = 'paste-post-uuid-here';
-- Review reports in the Supabase Table Editor, public.post_reports.
-- Display names are not verified identities. All posts are public.
