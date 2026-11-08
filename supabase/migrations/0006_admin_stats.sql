-- المرحلة 7: إعدادات الأدمن (طرد لاعب، نوع الغرفة، الكروت) + إحصائيات اللاعبين عند نهاية المباراة
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query (علامة +) > Run
-- (آمن لو اتشغّل أكثر من مرة)

alter table public.rooms add column if not exists allow_cards boolean not null default true;

-- منع استخدام الكروت لو الأدمن عطّلها (الاستخدام كله يتلغي لو الشرط فشل)
create or replace function public.check_cards_allowed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not (select allow_cards from public.rooms where id = new.room_id) then
    raise exception 'cards_disabled';
  end if;
  return new;
end;
$$;
drop trigger if exists card_uses_allowed on public.card_uses;
create trigger card_uses_allowed before insert on public.card_uses
  for each row execute function public.check_cards_allowed();

drop function if exists public.kick_player(uuid, uuid);
create function public.kick_player(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.rooms where id = p_room and admin_id = auth.uid()) then raise exception 'not_admin'; end if;
  if p_user = auth.uid() then raise exception 'invalid_target'; end if;
  delete from public.room_players where room_id = p_room and user_id = p_user;
end;
$$;

drop function if exists public.update_room_settings(uuid, text, boolean);
create function public.update_room_settings(p_room uuid, p_visibility text, p_allow_cards boolean)
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare v public.rooms;
begin
  select * into v from public.rooms where id = p_room for update;
  if not found or v.admin_id <> auth.uid() then raise exception 'not_admin'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'invalid_visibility'; end if;
  if p_visibility <> v.visibility and v.status <> 'waiting' then raise exception 'bad_phase'; end if;
  update public.rooms set visibility = p_visibility, allow_cards = p_allow_cards where id = p_room returning * into v;
  return v;
end;
$$;

-- نهاية المباراة: تحديث إحصائيات كل اللاعبين مرة واحدة فقط
create or replace function public.end_game(p_room uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_max integer;
begin
  update public.rooms set status = 'finished' where id = p_room and admin_id = auth.uid() and status = 'playing';
  if not found then raise exception 'not_admin'; end if;
  select max(score) into v_max from public.room_players where room_id = p_room;
  update public.profiles p
     set games_played = p.games_played + 1,
         total_points = p.total_points + rp.score,
         wins = p.wins + case when v_max > 0 and rp.score = v_max then 1 else 0 end
    from public.room_players rp
   where rp.room_id = p_room and rp.user_id = p.id;
end;
$$;

revoke execute on function public.kick_player(uuid, uuid), public.update_room_settings(uuid, text, boolean), public.end_game(uuid) from public, anon;
grant execute on function public.kick_player(uuid, uuid), public.update_room_settings(uuid, text, boolean), public.end_game(uuid) to authenticated;
