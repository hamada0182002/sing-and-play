-- المرحلة 10: وقت موحّد للدور 90 ثانية (تسجيل / إيقاف / إعادة طالما الوقت باقي) + إنهاء الدور مبكراً
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query (علامة +) > Run
-- (آمن لو اتشغّل أكثر من مرة). الأفضل تنهي أي مباراة شغّالة قبل ما تشغّله.

drop function if exists public.begin_round(uuid, uuid, text);
create function public.begin_round(p_room uuid, p_singer uuid default null, p_letter text default null)
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
          'singing', now() + interval '90 seconds')
  returning * into v_round;
  return v_round;
end;
$$;
revoke execute on function public.begin_round(uuid, uuid, text) from public, anon, authenticated;

-- انتهاء وقت الـ90 ثانية ينقل الدور للاستماع
create or replace function public.advance_round(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not public.is_room_member(v.room_id) then raise exception 'not_member'; end if;
  if v.phase = 'singing' and now() >= v.phase_ends_at then
    v.phase := 'listening';
    v.phase_ends_at := null;
  end if;
  update public.rounds set phase = v.phase, phase_ends_at = v.phase_ends_at where id = p_round
  returning * into v;
  return v;
end;
$$;

-- المغني ينهي دوره مبكراً بعد ما يسجّل
drop function if exists public.finish_turn(uuid);
create function public.finish_turn(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if v.singer_id <> auth.uid() then raise exception 'not_singer'; end if;
  if v.phase <> 'singing' then return v; end if;
  update public.rounds set phase = 'listening', phase_ends_at = null where id = p_round returning * into v;
  return v;
end;
$$;

drop function if exists public.start_singing(uuid);

-- الكروت: "فرصة ثانية" ترجّع الدور لنافذة 90 ثانية جديدة
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
       set phase = 'singing', phase_ends_at = now() + interval '90 seconds', attempt = attempt + 1,
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

revoke execute on function public.advance_round(uuid), public.finish_turn(uuid), public.use_card(uuid, text, uuid) from public, anon;
grant execute on function public.advance_round(uuid), public.finish_turn(uuid), public.use_card(uuid, text, uuid) to authenticated;
