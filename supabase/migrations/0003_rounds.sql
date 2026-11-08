-- المرحلة 4: محرك الدور (لاعب عشوائي + حرف عشوائي + عدادات 40 ثانية تفكير و20 ثانية غناء)
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query (علامة +) > Run

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_no integer not null,
  singer_id uuid not null references public.profiles(id) on delete cascade,
  letter text not null,
  phase text not null default 'thinking' check (phase in ('thinking', 'singing', 'listening', 'voting', 'result')),
  phase_ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, round_no)
);
create index rounds_room_idx on public.rounds (room_id);

alter table public.rounds enable row level security;

create policy "rounds readable by room members"
  on public.rounds for select to authenticated
  using (public.is_room_member(room_id));

revoke insert, update, delete on public.rounds from authenticated, anon;

-- دالة داخلية فقط (لا تُستدعى من التطبيق): تبدأ دوراً جديداً
create or replace function public.begin_round(p_room uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v_letters text[] := array['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
  v_singer uuid;
  v_no integer;
  v_round public.rounds;
begin
  select user_id into v_singer from public.room_players where room_id = p_room order by random() limit 1;
  select coalesce(max(round_no), 0) + 1 into v_no from public.rounds where room_id = p_room;
  insert into public.rounds (room_id, round_no, singer_id, letter, phase, phase_ends_at)
  values (p_room, v_no, v_singer, v_letters[1 + floor(random() * array_length(v_letters, 1))::integer], 'thinking', now() + interval '40 seconds')
  returning * into v_round;
  return v_round;
end;
$$;
revoke execute on function public.begin_round(uuid) from public, anon, authenticated;

create or replace function public.start_game(p_room uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v_room public.rooms;
  v_count integer;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.admin_id <> auth.uid() then raise exception 'not_admin'; end if;
  if v_room.status <> 'waiting' then raise exception 'already_started'; end if;
  select count(*) into v_count from public.room_players where room_id = p_room;
  if v_count < 2 then raise exception 'not_enough_players'; end if;
  update public.rooms set status = 'playing' where id = p_room;
  return public.begin_round(p_room);
end;
$$;

-- ينقل الدور للمرحلة التالية لو انتهى وقتها (آمنة لأي لاعب في الغرفة يستدعيها)
create or replace function public.advance_round(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not public.is_room_member(v.room_id) then raise exception 'not_member'; end if;
  if v.phase = 'thinking' and now() >= v.phase_ends_at then
    v.phase := 'singing';
    v.phase_ends_at := v.phase_ends_at + interval '20 seconds';
  end if;
  if v.phase = 'singing' and now() >= v.phase_ends_at then
    v.phase := 'listening';
    v.phase_ends_at := null;
  end if;
  update public.rounds set phase = v.phase, phase_ends_at = v.phase_ends_at where id = p_round
  returning * into v;
  return v;
end;
$$;

-- المغني يبدأ الغناء مبكراً قبل انتهاء وقت التفكير
create or replace function public.start_singing(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if v.singer_id <> auth.uid() then raise exception 'not_singer'; end if;
  if v.phase <> 'thinking' then return v; end if;
  update public.rounds set phase = 'singing', phase_ends_at = now() + interval '20 seconds' where id = p_round
  returning * into v;
  return v;
end;
$$;

create or replace function public.next_round(p_room uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v_room public.rooms;
  v_last public.rounds;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.admin_id <> auth.uid() then raise exception 'not_admin'; end if;
  if v_room.status <> 'playing' then raise exception 'not_playing'; end if;
  select * into v_last from public.rounds where room_id = p_room order by round_no desc limit 1;
  if v_last.phase <> 'listening' then raise exception 'round_not_finished'; end if;
  return public.begin_round(p_room);
end;
$$;

create or replace function public.end_game(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.rooms set status = 'finished' where id = p_room and admin_id = auth.uid();
  if not found then raise exception 'not_admin'; end if;
end;
$$;

create or replace function public.server_now()
returns timestamptz language sql stable as $$ select now() $$;

revoke execute on function public.start_game(uuid), public.advance_round(uuid), public.start_singing(uuid),
  public.next_round(uuid), public.end_game(uuid), public.server_now() from public, anon;
grant execute on function public.start_game(uuid), public.advance_round(uuid), public.start_singing(uuid),
  public.next_round(uuid), public.end_game(uuid), public.server_now() to authenticated;

alter publication supabase_realtime add table public.rounds;
