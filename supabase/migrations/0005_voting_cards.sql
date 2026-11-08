-- المرحلة 6: التصويت، نتيجة الدور، اعتماد الأدمن، النقاط، والكروت الأربعة
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query (علامة +) > Run
-- (آمن لو اتشغّل أكثر من مرة)

alter table public.rounds
  add column if not exists attempt integer not null default 1,
  add column if not exists approved boolean not null default false,
  add column if not exists skipped boolean not null default false,
  add column if not exists votes_count integer not null default 0,
  add column if not exists avg_stars numeric(3,1),
  add column if not exists points integer not null default 0;

alter table public.rooms
  add column if not exists forced_singer_id uuid references public.profiles(id) on delete set null,
  add column if not exists forced_letter text;

create table if not exists public.votes (
  round_id uuid not null references public.rounds(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  primary key (round_id, voter_id)
);
alter table public.votes enable row level security;
drop policy if exists "voters read own votes" on public.votes;
create policy "voters read own votes" on public.votes for select to authenticated using (voter_id = auth.uid());
revoke insert, update, delete on public.votes from authenticated, anon;

create table if not exists public.card_uses (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_type text not null check (card_type in ('second_chance', 'skip_turn', 'deduct_points', 'force_player')),
  round_id uuid references public.rounds(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  used_at timestamptz not null default now(),
  primary key (room_id, user_id, card_type)
);
alter table public.card_uses enable row level security;
drop policy if exists "card uses readable by room members" on public.card_uses;
create policy "card uses readable by room members" on public.card_uses for select to authenticated using (public.is_room_member(room_id));
revoke insert, update, delete on public.card_uses from authenticated, anon;

-- مسار التسجيل صار يحتوي رقم المحاولة (للكارت "فرصة ثانية")
drop policy if exists "singer uploads own round recording" on storage.objects;
create policy "singer uploads own round recording"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.rounds r
       where r.singer_id = auth.uid()
         and r.room_id::text = (storage.foldername(name))[1]
         and split_part(storage.filename(name), '.', 1) like r.id::text || '-%'
    )
  );
drop policy if exists "singer deletes own round recording" on storage.objects;
create policy "singer deletes own round recording"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.rounds r
       where r.singer_id = auth.uid()
         and r.room_id::text = (storage.foldername(name))[1]
         and split_part(storage.filename(name), '.', 1) like r.id::text || '-%'
    )
  );

drop function if exists public.begin_round(uuid, uuid, text);
drop function if exists public.finish_voting(uuid);
drop function if exists public.start_voting(uuid);
drop function if exists public.cast_vote(uuid, integer);
drop function if exists public.close_voting(uuid);
drop function if exists public.approve_round(uuid, integer);
drop function if exists public.use_card(uuid, text, uuid);

create or replace function public.finish_recording(p_round uuid, p_path text, p_ok boolean)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if v.singer_id <> auth.uid() then raise exception 'not_singer'; end if;
  if p_ok and (p_path is null or p_path not like v.room_id::text || '/' || v.id::text || '-' || v.attempt::text || '.%') then
    raise exception 'invalid_path';
  end if;
  update public.rounds
     set recording_status = case when p_ok then 'ready' else 'failed' end,
         recording_path = case when p_ok then p_path else null end
   where id = p_round
  returning * into v;
  return v;
end;
$$;

-- بدء دور: عشوائي، أو بمغني وحرف محددين (للكارت "إجبار لاعب")
drop function if exists public.begin_round(uuid);
create or replace function public.begin_round(p_room uuid, p_singer uuid default null, p_letter text default null)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v_letters text[] := array['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
  v_singer uuid := p_singer;
  v_no integer;
  v_round public.rounds;
begin
  if v_singer is null then
    select user_id into v_singer from public.room_players where room_id = p_room order by random() limit 1;
  end if;
  select coalesce(max(round_no), 0) + 1 into v_no from public.rounds where room_id = p_room;
  insert into public.rounds (room_id, round_no, singer_id, letter, phase, phase_ends_at)
  values (p_room, v_no, v_singer,
          coalesce(p_letter, v_letters[1 + floor(random() * array_length(v_letters, 1))::integer]),
          'thinking', now() + interval '40 seconds')
  returning * into v_round;
  return v_round;
end;
$$;
revoke execute on function public.begin_round(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.next_round(p_room uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v_room public.rooms;
  v_last public.rounds;
  v_round public.rounds;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.admin_id <> auth.uid() then raise exception 'not_admin'; end if;
  if v_room.status <> 'playing' then raise exception 'not_playing'; end if;
  select * into v_last from public.rounds where room_id = p_room order by round_no desc limit 1;
  if not v_last.approved then raise exception 'round_not_finished'; end if;
  if v_room.forced_singer_id is not null
     and exists (select 1 from public.room_players where room_id = p_room and user_id = v_room.forced_singer_id) then
    v_round := public.begin_round(p_room, v_room.forced_singer_id, v_room.forced_letter);
  else
    v_round := public.begin_round(p_room);
  end if;
  update public.rooms set forced_singer_id = null, forced_letter = null where id = p_room;
  return v_round;
end;
$$;

-- نهاية التصويت: يحسب المتوسط والنقاط (النقاط = المتوسط × 10)
create or replace function public.finish_voting(p_round uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_avg numeric;
begin
  select round(avg(stars)::numeric, 1) into v_avg from public.votes where round_id = p_round;
  update public.rounds
     set phase = 'result', phase_ends_at = null, avg_stars = v_avg,
         points = coalesce(round(v_avg * 10), 0)::integer
   where id = p_round;
end;
$$;
revoke execute on function public.finish_voting(uuid) from public, anon, authenticated;

create or replace function public.start_voting(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not exists (select 1 from public.rooms where id = v.room_id and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if v.phase <> 'listening' then raise exception 'bad_phase'; end if;
  if v.recording_status = 'pending' then raise exception 'recording_pending'; end if;
  update public.rounds set phase = 'voting', votes_count = 0 where id = p_round returning * into v;
  return v;
end;
$$;

create or replace function public.cast_vote(p_round uuid, p_stars integer)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v public.rounds;
  v_players integer;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not public.is_room_member(v.room_id) then raise exception 'not_member'; end if;
  if v.phase <> 'voting' then raise exception 'bad_phase'; end if;
  if v.singer_id = auth.uid() then raise exception 'self_vote'; end if;
  if p_stars < 1 or p_stars > 5 then raise exception 'invalid_stars'; end if;
  insert into public.votes (round_id, voter_id, stars) values (p_round, auth.uid(), p_stars)
  on conflict (round_id, voter_id) do update set stars = excluded.stars;
  select count(*) into v_players from public.room_players where room_id = v.room_id;
  update public.rounds set votes_count = (select count(*) from public.votes where round_id = p_round)
   where id = p_round returning * into v;
  if v.votes_count >= v_players - 1 then
    perform public.finish_voting(p_round);
    select * into v from public.rounds where id = p_round;
  end if;
  return v;
end;
$$;

create or replace function public.close_voting(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not exists (select 1 from public.rooms where id = v.room_id and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if v.phase <> 'voting' then raise exception 'bad_phase'; end if;
  perform public.finish_voting(p_round);
  select * into v from public.rounds where id = p_round;
  return v;
end;
$$;

-- الأدمن يعتمد النتيجة (أو يعدّل النقاط) وتُضاف للمغني
create or replace function public.approve_round(p_round uuid, p_points integer)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not exists (select 1 from public.rooms where id = v.room_id and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if v.phase <> 'result' or v.approved then raise exception 'bad_phase'; end if;
  if p_points < 0 or p_points > 100 then raise exception 'invalid_points'; end if;
  update public.rounds set approved = true, points = p_points where id = p_round returning * into v;
  update public.room_players set score = score + p_points where room_id = v.room_id and user_id = v.singer_id;
  return v;
end;
$$;

-- الكروت: كل لاعب يستخدم كل نوع مرة واحدة طوال المباراة
create or replace function public.use_card(p_room uuid, p_card text, p_target uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_round public.rounds;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_room from public.rooms where id = p_room for update;
  if not found or not public.is_room_member(p_room) then raise exception 'not_member'; end if;
  if v_room.status <> 'playing' then raise exception 'not_playing'; end if;
  if p_card not in ('second_chance', 'skip_turn', 'deduct_points', 'force_player') then raise exception 'invalid_card'; end if;
  if exists (select 1 from public.card_uses where room_id = p_room and user_id = v_uid and card_type = p_card) then
    raise exception 'card_used';
  end if;
  select * into v_round from public.rounds where room_id = p_room order by round_no desc limit 1 for update;
  if not found then raise exception 'bad_phase'; end if;

  if p_card = 'second_chance' then
    if v_round.singer_id <> v_uid then raise exception 'not_singer'; end if;
    if v_round.approved or v_round.phase in ('thinking', 'singing') then raise exception 'bad_phase'; end if;
    delete from public.votes where round_id = v_round.id;
    update public.rounds
       set phase = 'thinking', phase_ends_at = now() + interval '40 seconds', attempt = attempt + 1,
           recording_status = 'pending', recording_path = null, avg_stars = null, points = 0, votes_count = 0
     where id = v_round.id;

  elsif p_card = 'skip_turn' then
    if v_round.singer_id <> v_uid then raise exception 'not_singer'; end if;
    if v_round.approved then raise exception 'bad_phase'; end if;
    update public.rounds
       set phase = 'result', phase_ends_at = null, approved = true, skipped = true, points = 0
     where id = v_round.id;

  elsif p_card = 'deduct_points' then
    if p_target is null or p_target = v_uid then raise exception 'invalid_target'; end if;
    if not exists (select 1 from public.room_players where room_id = p_room and user_id = p_target) then raise exception 'invalid_target'; end if;
    update public.room_players set score = greatest(score - 10, 0) where room_id = p_room and user_id = p_target;

  else
    if p_target is null or p_target = v_uid then raise exception 'invalid_target'; end if;
    if not exists (select 1 from public.room_players where room_id = p_room and user_id = p_target) then raise exception 'invalid_target'; end if;
    if v_room.forced_singer_id is not null then raise exception 'force_pending'; end if;
    update public.rooms set forced_singer_id = p_target, forced_letter = v_round.letter where id = p_room;
  end if;

  insert into public.card_uses (room_id, user_id, card_type, round_id, target_id)
  values (p_room, v_uid, p_card, v_round.id, p_target);
end;
$$;

revoke execute on function public.start_voting(uuid), public.cast_vote(uuid, integer), public.close_voting(uuid),
  public.approve_round(uuid, integer), public.use_card(uuid, text, uuid), public.finish_recording(uuid, text, boolean) from public, anon;
grant execute on function public.start_voting(uuid), public.cast_vote(uuid, integer), public.close_voting(uuid),
  public.approve_round(uuid, integer), public.use_card(uuid, text, uuid), public.finish_recording(uuid, text, boolean) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.card_uses;
exception when duplicate_object then null;
end $$;
