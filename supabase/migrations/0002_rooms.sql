-- المرحلة 3: الغرف واللاعبون داخلها
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query > Run

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 2 and 30),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  max_players integer not null default 15 check (max_players between 2 and 15),
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_players_user_idx on public.room_players (user_id);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

create or replace function public.is_room_member(p_room uuid)
returns boolean language sql security definer stable set search_path = ''
as $$ select exists (select 1 from public.room_players where room_id = p_room and user_id = auth.uid()) $$;

create policy "rooms readable by members or if public"
  on public.rooms for select to authenticated
  using (visibility = 'public' or admin_id = auth.uid() or public.is_room_member(id));

create policy "players readable by room members"
  on public.room_players for select to authenticated
  using (public.is_room_member(room_id));

-- لا كتابة مباشرة من التطبيق: كل التعديلات عبر الدوال بالأسفل فقط
revoke insert, update, delete on public.rooms, public.room_players from authenticated, anon;

create or replace function public.make_room_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_room(p_name text, p_visibility text, p_max_players integer)
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(p_name);
  v_code text;
  v_room public.rooms;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 30 then raise exception 'invalid_name'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'invalid_visibility'; end if;
  if p_max_players < 2 or p_max_players > 15 then raise exception 'invalid_size'; end if;
  loop
    v_code := public.make_room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms (code, name, visibility, admin_id, max_players)
  values (v_code, v_name, p_visibility, v_uid, p_max_players)
  returning * into v_room;
  insert into public.room_players (room_id, user_id) values (v_room.id, v_uid);
  return v_room;
end;
$$;

create or replace function public.join_room(p_code text)
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'room_not_found'; end if;
  if exists (select 1 from public.room_players where room_id = v_room.id and user_id = v_uid) then
    return v_room;
  end if;
  if v_room.status <> 'waiting' then raise exception 'game_started'; end if;
  select count(*) into v_count from public.room_players where room_id = v_room.id;
  if v_count >= v_room.max_players then raise exception 'room_full'; end if;
  insert into public.room_players (room_id, user_id) values (v_room.id, v_uid);
  return v_room;
end;
$$;

create or replace function public.leave_room(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  delete from public.room_players where room_id = p_room and user_id = v_uid;
  if not exists (select 1 from public.room_players where room_id = p_room) then
    delete from public.rooms where id = p_room;
    return;
  end if;
  -- لو الأدمن خرج، تنتقل الإدارة لأقدم لاعب متبقٍ
  update public.rooms
     set admin_id = (select user_id from public.room_players where room_id = p_room order by joined_at limit 1)
   where id = p_room and admin_id = v_uid;
end;
$$;

create or replace function public.list_public_rooms()
returns table (id uuid, code text, name text, max_players integer, player_count bigint)
language sql security definer stable set search_path = ''
as $$
  select r.id, r.code, r.name, r.max_players,
         (select count(*) from public.room_players p where p.room_id = r.id)
    from public.rooms r
   where r.visibility = 'public' and r.status = 'waiting'
   order by r.created_at desc
   limit 50
$$;

revoke execute on function public.create_room(text, text, integer), public.join_room(text),
  public.leave_room(uuid), public.list_public_rooms() from public, anon;
grant execute on function public.create_room(text, text, integer), public.join_room(text),
  public.leave_room(uuid), public.list_public_rooms() to authenticated;

-- تفعيل التحديث اللحظي للجدولين
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
