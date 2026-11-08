-- المرحلة 14: (1) مدة التصويت 40 ثانية  (2) نتيجة التصويت تتعتمد أوتوماتيك من غير الأدمن
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query > Run (آمن لو اتشغّل أكثر من مرة).
-- لازم يكون 0011 و0012 اتشغّلوا قبله.

-- 1) التصويت يبدأ أول ما التسجيل يوصل (40 ثانية)، ولو التسجيل فشل الدور ينتهي بدون نقاط
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

  if v.phase = 'listening' then
    if p_ok then
      update public.rounds
         set phase = 'voting', votes_count = 0, voted_ids = '{}', phase_ends_at = now() + interval '40 seconds'
       where id = p_round returning * into v;
    else
      update public.rounds
         set phase = 'result', phase_ends_at = null, approved = true, skipped = true, points = 0
       where id = p_round returning * into v;
    end if;
  end if;
  return v;
end;
$$;
revoke execute on function public.finish_recording(uuid, text, boolean) from public, anon;
grant execute on function public.finish_recording(uuid, text, boolean) to authenticated;

-- 2) نهاية التصويت: يحسب المتوسط والنقاط ويعتمدهم فوراً ويضيف النقاط للمغني (مرة واحدة بس)
create or replace function public.finish_voting(p_round uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v public.rounds;
  v_avg numeric;
  v_pts integer;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found or v.phase <> 'voting' then return; end if;
  select round(avg(stars)::numeric, 1) into v_avg from public.votes where round_id = p_round;
  v_pts := coalesce(round(v_avg * 10), 0)::integer;
  update public.rounds
     set phase = 'result', phase_ends_at = null, avg_stars = v_avg, points = v_pts, approved = true
   where id = p_round;
  update public.room_players set score = score + v_pts where room_id = v.room_id and user_id = v.singer_id;
  if v_avg is not null then
    update public.profiles set stars_sum = stars_sum + v_avg, stars_rounds = stars_rounds + 1 where id = v.singer_id;
  end if;
end;
$$;
revoke execute on function public.finish_voting(uuid) from public, anon, authenticated;

-- 3) الكروت: "فرصة ثانية" و"تخطي الدور" يلغوا نقاط الدور المعتمد أوتوماتيك قبل ما يشتغلوا
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
    if (v_round.approved and v_round.skipped) or v_round.phase = 'singing' then raise exception 'bad_phase'; end if;
    if v_round.approved then
      -- النتيجة اتعتمدت أوتوماتيك: نلغي نقاطها قبل ما الكارت يشتغل
      update public.room_players set score = greatest(score - v_round.points, 0) where room_id = v_round.room_id and user_id = v_round.singer_id;
      if v_round.avg_stars is not null then
        update public.profiles set stars_sum = greatest(stars_sum - v_round.avg_stars, 0), stars_rounds = greatest(stars_rounds - 1, 0) where id = v_round.singer_id;
      end if;
    end if;
    delete from public.votes where round_id = v_round.id;
    update public.rounds
       set phase = 'singing', phase_ends_at = now() + interval '40 seconds', attempt = attempt + 1, approved = false,
           recording_status = 'pending', recording_path = null, avg_stars = null, points = 0,
           votes_count = 0, voted_ids = '{}'
     where id = v_round.id;

  elsif p_card = 'skip_turn' then
    if v_round.singer_id <> v_uid then raise exception 'not_singer'; end if;
    if v_round.approved and v_round.skipped then raise exception 'bad_phase'; end if;
    if v_round.approved then
      -- النتيجة اتعتمدت أوتوماتيك: نلغي نقاطها قبل ما الكارت يشتغل
      update public.room_players set score = greatest(score - v_round.points, 0) where room_id = v_round.room_id and user_id = v_round.singer_id;
      if v_round.avg_stars is not null then
        update public.profiles set stars_sum = greatest(stars_sum - v_round.avg_stars, 0), stars_rounds = greatest(stars_rounds - 1, 0) where id = v_round.singer_id;
      end if;
    end if;
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

revoke execute on function public.use_card(uuid, text, uuid) from public, anon;
grant execute on function public.use_card(uuid, text, uuid) to authenticated;
