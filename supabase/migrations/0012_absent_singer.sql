-- المرحلة 13: لو المغني خرج من اللعبة أو انقطع نتّه، دوره يتخطى أوتوماتيك والكل يتعرف
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query > Run (آمن لو اتشغّل أكثر من مرة).
-- لازم يكون 0011 اتشغّل قبله.

alter table public.room_players add column if not exists last_seen timestamptz not null default now();
alter table public.rounds add column if not exists notice text;

-- نبضة حضور: كل لاعب في اللعبة بيبعتها كل 5 ثواني
create or replace function public.ping_room(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.room_players set last_seen = now() where room_id = p_room and user_id = auth.uid();
end;
$$;

-- بدء الدور: نفس ترتيب 0011 + المغني يتحسب حاضر وقت بداية دوره
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
      update public.room_players set sang_in_cycle = false where room_id = p_room;
      select user_id into v_singer from public.room_players
       where room_id = p_room and user_id is distinct from v_last
       order by random() limit 1;
      if v_singer is null then
        select user_id into v_singer from public.room_players where room_id = p_room limit 1;
      end if;
    end if;
  end if;

  update public.room_players set sang_in_cycle = true, last_seen = now() where room_id = p_room and user_id = v_singer;

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

-- نهاية المباراة من جوه السيرفر (لما يتبقى أقل من لاعبين)
create or replace function public.finish_game_internal(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_max integer;
begin
  update public.rooms set status = 'finished' where id = p_room and status = 'playing';
  if not found then return; end if;
  select max(score) into v_max from public.room_players where room_id = p_room;
  update public.profiles p
     set games_played = p.games_played + 1,
         total_points = p.total_points + rp.score,
         wins = p.wins + case when v_max > 0 and rp.score = v_max then 1 else 0 end
    from public.room_players rp
   where rp.room_id = p_room and rp.user_id = p.id;
end;
$$;
revoke execute on function public.finish_game_internal(uuid) from public, anon, authenticated;

-- لاعب خرج / اتطرد / انقطع اتصاله (p_why = left | kicked | disconnected)
create or replace function public.handle_player_removed(p_room uuid, p_user uuid, p_why text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_room public.rooms;
  v_round public.rounds;
  v_next public.rounds;
  v_name text;
  v_players integer;
  v_votes integer;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found or v_room.status <> 'playing' then return; end if;
  select * into v_round from public.rounds where room_id = p_room order by round_no desc limit 1 for update;
  if not found or v_round.approved then return; end if;
  select count(*) into v_players from public.room_players where room_id = p_room;

  if v_round.singer_id = p_user then
    select display_name into v_name from public.profiles where id = p_user;
    update public.rounds
       set phase = 'result', phase_ends_at = null, approved = true, skipped = true, points = 0
     where id = v_round.id;

    if v_players < 2 then
      perform public.finish_game_internal(p_room);
      return;
    end if;

    if v_room.forced_singer_id is not null
       and exists (select 1 from public.room_players where room_id = p_room and user_id = v_room.forced_singer_id) then
      v_next := public.begin_round(p_room, v_room.forced_singer_id, v_room.forced_letter);
    else
      v_next := public.begin_round(p_room);
    end if;
    update public.rooms set forced_singer_id = null, forced_letter = null where id = p_room;

    update public.rounds
       set notice = coalesce(v_name, 'اللاعب') || case p_why
             when 'left' then ' خرج من اللعبة، وتم تخطي دوره'
             when 'kicked' then ' اتطرد من اللعبة، وتم تخطي دوره'
             else ' انقطع اتصاله، وتم تخطي دوره' end
     where id = v_next.id;

  elsif v_round.phase = 'voting' and p_why <> 'disconnected' then
    -- مصوّت خرج: لو الباقيين كلهم صوّتوا ننهي التصويت
    select count(*) into v_votes
      from public.votes v
      join public.room_players rp on rp.room_id = p_room and rp.user_id = v.voter_id
     where v.round_id = v_round.id;
    update public.rounds
       set votes_count = v_votes,
           voted_ids = (select coalesce(array_agg(v.voter_id), '{}') from public.votes v
                          join public.room_players rp on rp.room_id = p_room and rp.user_id = v.voter_id
                         where v.round_id = v_round.id)
     where id = v_round.id;
    if v_votes >= v_players - 1 then
      perform public.finish_voting(v_round.id);
    end if;
  end if;
end;
$$;
revoke execute on function public.handle_player_removed(uuid, uuid, text) from public, anon, authenticated;

-- أي لاعب في الغرفة يقدر يسأل: هل المغني غايب؟ (السيرفر هو اللي يقرر من آخر نبضة)
create or replace function public.skip_absent_singer(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare
  v public.rounds;
  v_seen timestamptz;
  v_found boolean;
begin
  select * into v from public.rounds where id = p_round;
  if not found then raise exception 'round_not_found'; end if;
  if not public.is_room_member(v.room_id) then raise exception 'not_member'; end if;

  if not v.approved and v.phase in ('singing', 'listening', 'voting') and v.singer_id <> auth.uid() then
    select last_seen into v_seen from public.room_players where room_id = v.room_id and user_id = v.singer_id;
    v_found := found;
    if not v_found or v_seen < now() - interval '25 seconds' then
      perform public.handle_player_removed(v.room_id, v.singer_id, case when v_found then 'disconnected' else 'left' end);
    end if;
  end if;

  select * into v from public.rounds where room_id = v.room_id order by round_no desc limit 1;
  return v;
end;
$$;

-- الخروج والطرد يستدعوا نفس المنطق
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
  update public.rooms
     set admin_id = (select user_id from public.room_players where room_id = p_room order by joined_at limit 1)
   where id = p_room and admin_id = v_uid;
  perform public.handle_player_removed(p_room, v_uid, 'left');
end;
$$;

create or replace function public.kick_player(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.rooms where id = p_room and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if p_user = auth.uid() then raise exception 'invalid_target'; end if;
  delete from public.room_players where room_id = p_room and user_id = p_user;
  perform public.handle_player_removed(p_room, p_user, 'kicked');
end;
$$;

revoke execute on function public.ping_room(uuid), public.skip_absent_singer(uuid), public.leave_room(uuid), public.kick_player(uuid, uuid) from public, anon;
grant execute on function public.ping_room(uuid), public.skip_absent_singer(uuid), public.leave_room(uuid), public.kick_player(uuid, uuid) to authenticated;
