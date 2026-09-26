-- Облачные сохранения «Гильдии Алхимиков».
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run.
-- Также включить: Authentication → Sign In / Providers → Anonymous sign-ins.

-- Текущий сейв игрока (одна строка на пользователя)
create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 262144), -- до 256 КБ
  progress   double precision not null default 0,                   -- золото за всё время (для выбора при конфликте)
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Резервные копии: храним 3 последние
create table if not exists public.save_backups (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 262144),
  progress   double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists save_backups_user_idx on public.save_backups (user_id, created_at desc);

-- Row Level Security: каждый видит и меняет только свои строки
alter table public.saves enable row level security;
alter table public.save_backups enable row level security;

drop policy if exists "saves: read own" on public.saves;
drop policy if exists "saves: insert own" on public.saves;
drop policy if exists "saves: update own" on public.saves;
drop policy if exists "saves: delete own" on public.saves;
create policy "saves: read own"   on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "saves: insert own" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saves: update own" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saves: delete own" on public.saves for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "backups: read own" on public.save_backups;
drop policy if exists "backups: insert own" on public.save_backups;
drop policy if exists "backups: delete own" on public.save_backups;
create policy "backups: read own"   on public.save_backups for select to authenticated using ((select auth.uid()) = user_id);
create policy "backups: insert own" on public.save_backups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "backups: delete own" on public.save_backups for delete to authenticated using ((select auth.uid()) = user_id);

-- Оставляем только 3 последние резервные копии
create or replace function public.trim_save_backups() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.save_backups
  where user_id = new.user_id
    and id not in (select id from public.save_backups where user_id = new.user_id order by created_at desc limit 3);
  return null;
end $$;

drop trigger if exists trim_save_backups on public.save_backups;
create trigger trim_save_backups after insert on public.save_backups
for each row execute function public.trim_save_backups();

-- Удаление аккаунта из игры (требование App Store). Удаляет пользователя и каскадом все его сейвы.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = (select auth.uid());
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
