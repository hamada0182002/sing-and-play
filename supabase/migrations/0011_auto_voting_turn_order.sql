-- المرحلة 12: (1) التصويت يبدأ تلقائياً أول ما تسجيل المغني يتبعت
--             (2) ترتيب المغنين عشوائي لكن بالدور: كل لاعب يغني مرة في كل لفّة، ومفيش حد يغني مرتين ورا بعض
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query > Run (آمن لو اتشغّل أكثر من مرة).

-- 1) علامة "غنّى في اللفّة الحالية"
alter table public.room_players add column if not exists sang_in_cycle boolean not null default false;

-- 2) اختيار المغني: عشوائي من اللي لسه ما غنّاش في اللفّة، ومش هو المغني السابق.
--    لو الكل غنّى تبدأ لفّة جديدة (وبرضه أول واحد مش هو آخر مغني).
create or replace function public.begin_round(p_room uuid, p_singer uuid default null, p_letter text default null)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v_letters text[] := array['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];
  v_singer uuid := p_singer;
  v_last uuid;
  v_no integer;
  v_round public.rounds;
begin
  select singer_id into v_last from public.rounds where room_id = p_room order by round_no desc limit 1;

  if v_singer is null then
    select user_id into v_singer from public.room_players
     where room_id = p_room and not sang_in_cycle and user_id is distinct from v_last
     order by random() limit 1;

    if v_singer is null then
      -- الكل غنّى: لفّة جديدة
      update public.room_players set sang_in_cycle = false where room_id = p_room;
      select user_id into v_singer from public.room_players
       where room_id = p_room and user_id is distinct from v_last
       order by random() limit 1;
      if v_singer is null then
        select user_id into v_singer from public.room_players where room_id = p_room limit 1; -- لاعب واحد بس
      end if;
    end if;
  end if;

  update public.room_players set sang_in_cycle = true where room_id = p_room and user_id = v_singer;

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

-- 3) "العب مجدداً" يصفّر اللفّة كمان
create or replace function public.restart_game(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.rooms set status = 'waiting', forced_singer_id = null, forced_letter = null
   where id = p_room and admin_id = auth.uid() and status = 'finished';
  if not found then raise exception 'not_admin'; end if;
  delete from public.card_uses where room_id = p_room;
  delete from public.rounds where room_id = p_room;
  update public.room_players set score = 0, sang_in_cycle = false where room_id = p_room;
end;
$$;
revoke execute on function public.restart_game(uuid) from public, anon;
grant execute on function public.restart_game(uuid) to authenticated;

-- 4) أول ما التسجيل يتبعت: التصويت يبدأ فوراً (40 ثانية).
--    لو التسجيل فشل: الدور ينتهي بدون نقاط (بدل ما اللعبة تفضل مستنية الأدمن).
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
