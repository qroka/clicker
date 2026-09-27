-- Код восстановления: переносит облачный сейв на новую установку / новое устройство.
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run (после 001_cloud_saves.sql).

create table if not exists public.recovery_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.recovery_codes enable row level security;
drop policy if exists "recovery: read own" on public.recovery_codes;
create policy "recovery: read own" on public.recovery_codes for select to authenticated using ((select auth.uid()) = user_id);

-- Выдать код текущему игроку (создаёт при первом вызове). Формат XXXX-XXXX-XXXX,
-- алфавит без похожих символов (нет I, O, 0, 1): 32^12 ≈ 1,2·10^18 вариантов.
create or replace function public.create_recovery_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid      uuid := auth.uid();
  existing text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes    bytea;
  raw      text;
  i        int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  loop
    select code into existing from public.recovery_codes where user_id = uid;
    if existing is not null then return existing; end if;
    bytes := gen_random_bytes(12);
    raw := '';
    for i in 0..11 loop
      raw := raw || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    raw := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
    begin
      insert into public.recovery_codes (user_id, code) values (uid, raw);
      return raw;
    exception when unique_violation then
      -- совпал чужой код или параллельный вызов — пробуем снова (цикл вернёт уже созданный)
    end;
  end loop;
end $$;

-- Забрать сейв по коду: сейв, резервные копии и сам код переходят к текущему игроку,
-- старый анонимный аккаунт удаляется. Возвращает данные сейва (или null, если код неверный).
create or replace function public.claim_recovery_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  norm   text;
  owner  uuid;
  result jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(norm) <> 12 then return null; end if;
  norm := substr(norm, 1, 4) || '-' || substr(norm, 5, 4) || '-' || substr(norm, 9, 4);

  select user_id into owner from public.recovery_codes where code = norm;
  if owner is null then return null; end if;

  if owner <> uid then
    delete from public.saves where user_id = uid;
    delete from public.save_backups where user_id = uid;
    delete from public.recovery_codes where user_id = uid;
    update public.saves set user_id = uid where user_id = owner;
    update public.save_backups set user_id = uid where user_id = owner;
    update public.recovery_codes set user_id = uid where user_id = owner;
    delete from auth.users where id = owner and is_anonymous;
  end if;

  select data into result from public.saves where user_id = uid;
  return result;
end $$;

revoke all on function public.create_recovery_code() from public, anon;
revoke all on function public.claim_recovery_code(text) from public, anon;
grant execute on function public.create_recovery_code() to authenticated;
grant execute on function public.claim_recovery_code(text) to authenticated;
