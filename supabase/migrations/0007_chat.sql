-- المرحلة 8: الشات داخل الغرفة + مفتاح "السماح بالشات" في إعدادات الأدمن
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query (علامة +) > Run
-- (آمن لو اتشغّل أكثر من مرة)

alter table public.rooms add column if not exists allow_chat boolean not null default true;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists messages_room_idx on public.messages (room_id, created_at desc);

alter table public.messages enable row level security;
drop policy if exists "room members read messages" on public.messages;
create policy "room members read messages" on public.messages for select to authenticated using (public.is_room_member(room_id));
revoke insert, update, delete on public.messages from authenticated, anon;

drop function if exists public.send_message(uuid, text);
create function public.send_message(p_room uuid, p_body text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := trim(p_body);
begin
  if v_uid is null or not public.is_room_member(p_room) then raise exception 'not_member'; end if;
  if not (select allow_chat from public.rooms where id = p_room) then raise exception 'chat_disabled'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 200 then raise exception 'invalid_message'; end if;
  if exists (select 1 from public.messages where room_id = p_room and user_id = v_uid and created_at > now() - interval '1 second') then
    raise exception 'too_fast';
  end if;
  insert into public.messages (room_id, user_id, body) values (p_room, v_uid, v_body);
end;
$$;

drop function if exists public.update_room_settings(uuid, text, boolean);
drop function if exists public.update_room_settings(uuid, text, boolean, boolean);
create function public.update_room_settings(p_room uuid, p_visibility text, p_allow_cards boolean, p_allow_chat boolean)
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare v public.rooms;
begin
  select * into v from public.rooms where id = p_room for update;
  if not found or v.admin_id <> auth.uid() then raise exception 'not_admin'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'invalid_visibility'; end if;
  if p_visibility <> v.visibility and v.status <> 'waiting' then raise exception 'bad_phase'; end if;
  update public.rooms set visibility = p_visibility, allow_cards = p_allow_cards, allow_chat = p_allow_chat
   where id = p_room returning * into v;
  return v;
end;
$$;

revoke execute on function public.send_message(uuid, text), public.update_room_settings(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.send_message(uuid, text), public.update_room_settings(uuid, text, boolean, boolean) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
