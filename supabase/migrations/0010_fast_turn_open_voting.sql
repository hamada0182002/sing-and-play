-- المرحلة 11: دور 40 ثانية، إرسال التسجيل تلقائياً (المغني ما بيسمعوش قبل الإرسال)،
-- تصويت من 0 إلى 5 بمؤقت 15 ثانية، وعرض مين صوّت ومين لسه.
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query > Run (آمن لو اتشغّل أكثر من مرة).

-- 1) نجوم من 0 إلى 5
alter table public.votes drop constraint if exists votes_stars_check;
alter table public.votes add constraint votes_stars_check check (stars between 0 and 5);

-- 2) قائمة اللي صوّتوا (بدون النجوم نفسها)
alter table public.rounds add column if not exists voted_ids uuid[] not null default '{}';

-- 3) الدور 40 ثانية
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
          'singing', now() + interval '40 seconds')
  returning * into v_round;
  return v_round;
end;
$$;
revoke execute on function public.begin_round(uuid, uuid, text) from public, anon, authenticated;

-- 4) التسجيل يتبعت للجميع تلقائياً أول ما يخلص رفعه
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
     set recording_status = case when p_ok then 'shared' else 'failed' end,
         recording_path = case when p_ok then p_path else null end
   where id = p_round
  returning * into v;
  return v;
end;
$$;

-- 5) بدء التصويت بمؤقت 15 ثانية
create or replace function public.start_voting(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not exists (select 1 from public.rooms where id = v.room_id and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if v.phase <> 'listening' then raise exception 'bad_phase'; end if;
  if v.recording_status not in ('shared', 'failed') then raise exception 'recording_pending'; end if;
  update public.rounds
     set phase = 'voting', votes_count = 0, voted_ids = '{}', phase_ends_at = now() + interval '15 seconds'
   where id = p_round returning * into v;
  return v;
end;
$$;

-- 6) التصويت من 0 إلى 5 + تسجيل مين صوّت
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
  if p_stars < 0 or p_stars > 5 then raise exception 'invalid_stars'; end if;
  insert into public.votes (round_id, voter_id, stars) values (p_round, auth.uid(), p_stars)
  on conflict (round_id, voter_id) do update set stars = excluded.stars;
  select count(*) into v_players from public.room_players where room_id = v.room_id;
  update public.rounds
     set votes_count = (select count(*) from public.votes where round_id = p_round),
         voted_ids = (select coalesce(array_agg(voter_id), '{}') from public.votes where round_id = p_round)
   where id = p_round returning * into v;
  if v.votes_count >= v_players - 1 then
    perform public.finish_voting(p_round);
    select * into v from public.rounds where id = p_round;
  end if;
  return v;
end;
$$;

-- 7) انتهاء وقت الدور أو التصويت ينقل المرحلة تلقائياً
create or replace function public.advance_round(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not public.is_room_member(v.room_id) then raise exception 'not_member'; end if;
  if v.phase = 'singing' and now() >= v.phase_ends_at then
    update public.rounds set phase = 'listening', phase_ends_at = null where id = p_round;
  elsif v.phase = 'voting' and v.phase_ends_at is not null and now() >= v.phase_ends_at then
    perform public.finish_voting(p_round);
  end if;
  select * into v from public.rounds where id = p_round;
  return v;
end;
$$;

-- 8) "فرصة ثانية": نافذة 40 ثانية جديدة
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
    if v_round.approved or v_round.phase = 'singing' then raise exception 'bad_phase'; end if;
    delete from public.votes where round_id = v_round.id;
    update public.rounds
       set phase = 'singing', phase_ends_at = now() + interval '40 seconds', attempt = attempt + 1,
           recording_status = 'pending', recording_path = null, avg_stars = null, points = 0,
           votes_count = 0, voted_ids = '{}'
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

revoke execute on function public.advance_round(uuid), public.start_voting(uuid), public.cast_vote(uuid, integer),
  public.use_card(uuid, text, uuid), public.finish_recording(uuid, text, boolean) from public, anon;
grant execute on function public.advance_round(uuid), public.start_voting(uuid), public.cast_vote(uuid, integer),
  public.use_card(uuid, text, uuid), public.finish_recording(uuid, text, boolean) to authenticated;
