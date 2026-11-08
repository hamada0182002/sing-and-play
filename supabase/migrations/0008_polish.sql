-- المرحلة 9: مراجعة المغني لتسجيله قبل ما الناس تسمعه، الأدمن لا يعدّل النقاط، "العب مجدداً"، ومتوسط النجوم في الملف
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query (علامة +) > Run
-- (آمن لو اتشغّل أكثر من مرة)

-- حالات التسجيل: pending (يترفع) > ready (عند المغني فقط) > shared (للجميع) / failed / cancelled
alter table public.rounds drop constraint if exists rounds_recording_status_check;
alter table public.rounds add constraint rounds_recording_status_check
  check (recording_status in ('pending', 'ready', 'shared', 'failed', 'cancelled'));

alter table public.profiles
  add column if not exists stars_sum numeric not null default 0,
  add column if not exists stars_rounds integer not null default 0;

-- التسجيل لا يسمعه غير المغني حتى يضغط "أرسل للجميع"
drop policy if exists "room members read recordings" on storage.objects;
create policy "room members read recordings"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.rounds r
       where r.room_id::text = (storage.foldername(name))[1]
         and split_part(storage.filename(name), '.', 1) like r.id::text || '-%'
         and (r.singer_id = auth.uid() or (r.recording_status = 'shared' and public.is_room_member(r.room_id)))
    )
  );

drop function if exists public.share_recording(uuid);
create function public.share_recording(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if v.singer_id <> auth.uid() then raise exception 'not_singer'; end if;
  if v.phase <> 'listening' or v.recording_status <> 'ready' then raise exception 'bad_phase'; end if;
  update public.rounds set recording_status = 'shared' where id = p_round returning * into v;
  return v;
end;
$$;

-- المغني (أو الأدمن لو المغني اختفى) يلغي التسجيل قبل ما يتبعت: الدور ينتهي بدون نقاط
drop function if exists public.cancel_recording(uuid);
create function public.cancel_recording(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if v.singer_id <> auth.uid()
     and not exists (select 1 from public.rooms where id = v.room_id and admin_id = auth.uid()) then
    raise exception 'not_singer';
  end if;
  if v.phase <> 'listening' or v.recording_status = 'shared' then raise exception 'bad_phase'; end if;
  update public.rounds
     set phase = 'result', phase_ends_at = null, approved = true, skipped = true,
         recording_status = 'cancelled', recording_path = null, points = 0
   where id = p_round returning * into v;
  return v;
end;
$$;

-- التصويت يبدأ بعد ما التسجيل يتبعت للجميع
drop function if exists public.start_voting(uuid);
create function public.start_voting(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not exists (select 1 from public.rooms where id = v.room_id and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if v.phase <> 'listening' then raise exception 'bad_phase'; end if;
  if v.recording_status not in ('shared', 'failed') then raise exception 'recording_pending'; end if;
  update public.rounds set phase = 'voting', votes_count = 0 where id = p_round returning * into v;
  return v;
end;
$$;

-- الأدمن يعتمد النتيجة كما حسبها النظام (بدون تعديل النقاط)
drop function if exists public.approve_round(uuid, integer);
drop function if exists public.approve_round(uuid);
create function public.approve_round(p_round uuid)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if not exists (select 1 from public.rooms where id = v.room_id and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if v.phase <> 'result' or v.approved then raise exception 'bad_phase'; end if;
  update public.rounds set approved = true where id = p_round returning * into v;
  update public.room_players set score = score + v.points where room_id = v.room_id and user_id = v.singer_id;
  if v.avg_stars is not null then
    update public.profiles set stars_sum = stars_sum + v.avg_stars, stars_rounds = stars_rounds + 1 where id = v.singer_id;
  end if;
  return v;
end;
$$;

-- "العب مجدداً": الأدمن يرجّع الغرفة للانتظار ويصفّر النقاط والكروت
drop function if exists public.restart_game(uuid);
create function public.restart_game(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.rooms set status = 'waiting', forced_singer_id = null, forced_letter = null
   where id = p_room and admin_id = auth.uid() and status = 'finished';
  if not found then raise exception 'not_admin'; end if;
  delete from public.card_uses where room_id = p_room;
  delete from public.rounds where room_id = p_room;
  update public.room_players set score = 0 where room_id = p_room;
end;
$$;

revoke execute on function public.share_recording(uuid), public.cancel_recording(uuid), public.start_voting(uuid),
  public.approve_round(uuid), public.restart_game(uuid) from public, anon;
grant execute on function public.share_recording(uuid), public.cancel_recording(uuid), public.start_voting(uuid),
  public.approve_round(uuid), public.restart_game(uuid) to authenticated;
