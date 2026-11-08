-- المرحلة 5: التسجيل الصوتي المؤقت (رفع من المغني + استماع كل اللاعبين)
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query (علامة +) > Run

alter table public.rounds
  add column recording_path text,
  add column recording_status text not null default 'pending'
    check (recording_status in ('pending', 'ready', 'failed'));

-- المغني يعلن انتهاء الرفع (نجح أو فشل)
create or replace function public.finish_recording(p_round uuid, p_path text, p_ok boolean)
returns public.rounds language plpgsql security definer set search_path = ''
as $$
declare v public.rounds;
begin
  select * into v from public.rounds where id = p_round for update;
  if not found then raise exception 'round_not_found'; end if;
  if v.singer_id <> auth.uid() then raise exception 'not_singer'; end if;
  if p_ok and (p_path is null or p_path not like v.room_id::text || '/' || v.id::text || '.%') then
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
revoke execute on function public.finish_recording(uuid, text, boolean) from public, anon;
grant execute on function public.finish_recording(uuid, text, boolean) to authenticated;

-- مخزن خاص للتسجيلات (حد أقصى 5 ميجا للملف)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 5242880, array['audio/webm', 'audio/mp4'])
on conflict (id) do nothing;

-- المغني فقط يرفع تسجيل دوره
create policy "singer uploads own round recording"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.rounds r
       where r.singer_id = auth.uid()
         and r.room_id::text = (storage.foldername(name))[1]
         and r.id::text = split_part(storage.filename(name), '.', 1)
    )
  );

-- أعضاء الغرفة فقط يسمعون
create policy "room members read recordings"
  on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and public.is_room_member(((storage.foldername(name))[1])::uuid));

-- أدمن الغرفة يحذف التسجيل بعد انتهاء الدور
create policy "room admin deletes recordings"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.rooms rm
       where rm.id::text = (storage.foldername(name))[1] and rm.admin_id = auth.uid()
    )
  );
