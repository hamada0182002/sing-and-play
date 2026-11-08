-- المرحلة 15: اختيار اللعبة «قبل» إنشاء الغرفة (الغرفة بتتعمل للعبة معيّنة)
-- شغّل هذا الملف كاملاً مرة واحدة: Supabase > SQL Editor > New query > Run
-- (لازم تكون شغّلت 0014 قبله). آمن للتكرار.

-- 1) إنشاء غرفة للعبة معيّنة (الافتراضي: لعبة الغنا، فالتطبيق القديم يفضل شغال)
drop function if exists public.create_room(text, text, integer);
create or replace function public.create_room(p_name text, p_visibility text, p_max_players integer, p_game text default 'sing')
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(p_name);
  v_code text;
  v_room public.rooms;
  g public.games;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 30 then raise exception 'invalid_name'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'invalid_visibility'; end if;
  select * into g from public.games where id = coalesce(p_game, 'sing') and enabled;
  if not found then raise exception 'unknown_game'; end if;
  -- عدد اللاعبين لازم يناسب اللعبة (الغنا من 2 لـ15، أنا مين من 3 لـ10)
  if p_max_players < greatest(2, g.min_players) or p_max_players > least(15, g.max_players) then raise exception 'invalid_size'; end if;
  loop
    v_code := public.make_room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms (code, name, visibility, admin_id, max_players, selected_game)
  values (v_code, v_name, p_visibility, v_uid, p_max_players, g.id)
  returning * into v_room;
  insert into public.room_players (room_id, user_id) values (v_room.id, v_uid);
  return v_room;
end;
$$;
revoke execute on function public.create_room(text, text, integer, text) from public, anon;
grant execute on function public.create_room(text, text, integer, text) to authenticated;

-- 2) قايمة الغرف العامة: بتطلّع اللعبة، ومعاها فلتر اختياري باللعبة
drop function if exists public.list_public_rooms();
create or replace function public.list_public_rooms(p_game text default null)
returns table (id uuid, code text, name text, max_players integer, player_count bigint, selected_game text)
language sql security definer stable set search_path = ''
as $$
  select r.id, r.code, r.name, r.max_players,
         (select count(*) from public.room_players p where p.room_id = r.id),
         r.selected_game
    from public.rooms r
   where r.visibility = 'public' and r.status = 'waiting'
     and (p_game is null or r.selected_game = p_game)
   order by r.created_at desc
   limit 50
$$;
revoke execute on function public.list_public_rooms(text) from public, anon;
grant execute on function public.list_public_rooms(text) to authenticated;

notify pgrst, 'reload schema';
