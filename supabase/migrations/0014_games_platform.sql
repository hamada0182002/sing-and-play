-- المرحلة 14: منصة الألعاب المتعددة (يلا غني مع الحرف + أنا مين؟)
-- شغّل هذا الملف كاملاً مرة واحدة: Supabase > SQL Editor > New query > Run
-- آمن للتكرار: لو اتشغّل مرتين مش هيعمل مشاكل.
-- مفيش أي جدول أو دالة قديمة بتتحذف. التعديل الوحيد على دالة قديمة: handle_player_removed (في آخر الملف).

-- ─────────────────────────────────────────────
-- 1) سجل الألعاب: قايمة الألعاب المتاحة وعدد لاعبين كل لعبة
--    لإضافة لعبة جديدة مستقبلاً: سطر واحد هنا.
-- ─────────────────────────────────────────────
create table if not exists public.games (
  id text primary key,
  title text not null,
  min_players integer not null,
  max_players integer not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  check (min_players >= 1 and max_players >= min_players)
);
alter table public.games enable row level security;
drop policy if exists "games readable by signed-in users" on public.games;
create policy "games readable by signed-in users"
  on public.games for select to authenticated using (true);
revoke insert, update, delete on public.games from authenticated, anon;

insert into public.games (id, title, min_players, max_players, sort_order) values
  ('sing', 'يلا غني مع الحرف', 2, 15, 1),
  ('who_am_i', 'أنا مين؟', 3, 10, 2)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 2) الغرفة تعرف: إيه اللعبة المختارة؟ وإيه اللعبة الشغالة دلوقتي؟
--    active_game = null يعني لعبة الغنا (زي ما كانت قبل التعديل)
-- ─────────────────────────────────────────────
alter table public.rooms add column if not exists selected_game text not null default 'sing' references public.games(id);
alter table public.rooms add column if not exists active_game text references public.games(id);

-- الأدمن بس يختار اللعبة، وقبل ما المباراة تبدأ (الكل يشوف الاختيار لحظياً لأن جدول rooms متفعّل عليه Realtime)
create or replace function public.select_game(p_room uuid, p_game text)
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare v public.rooms;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v from public.rooms where id = p_room for update;
  if not found or v.admin_id <> auth.uid() then raise exception 'not_admin'; end if;
  if v.status <> 'waiting' then raise exception 'bad_phase'; end if;
  if not exists (select 1 from public.games where id = p_game and enabled) then raise exception 'unknown_game'; end if;
  update public.rooms set selected_game = p_game where id = p_room returning * into v;
  return v;
end;
$$;
revoke execute on function public.select_game(uuid, text) from public, anon;
grant execute on function public.select_game(uuid, text) to authenticated;

-- ─────────────────────────────────────────────
-- 3) لعبة أنا مين؟: حالة اللعبة (فيها الشخصيات السرية) — مقفولة تماماً على التطبيق
--    الوحيد اللي يقرأها ويكتبها هو الـEdge Function (مفتاح الخدمة)
-- ─────────────────────────────────────────────
create table if not exists public.who_am_i_games (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  state jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.who_am_i_games enable row level security;
revoke all on public.who_am_i_games from anon, authenticated;   -- ولا سياسة قراءة: مفيش حد من التطبيق يقدر يقرأها

-- "إشارة" بس (رقم نسخة، من غير أي أسرار): لما يتغيّر، كل لاعب يطلب من الخادم نسخته الآمنة الخاصة بيه
create table if not exists public.who_am_i_signal (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.who_am_i_signal enable row level security;
drop policy if exists "signal readable by room members" on public.who_am_i_signal;
create policy "signal readable by room members"
  on public.who_am_i_signal for select to authenticated using (public.is_room_member(room_id));
revoke insert, update, delete on public.who_am_i_signal from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'who_am_i_signal') then
    alter publication supabase_realtime add table public.who_am_i_signal;
  end if;
end $$;

-- تفعيل اللعبة للغرفة: الخادم فقط. بتتأكد من الأدمن والحالة وعدد اللاعبين وتقلب الغرفة لـ"playing" في خطوة واحدة
create or replace function public.wai_activate(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v public.rooms;
  g public.games;
  v_count integer;
begin
  select * into v from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if v.admin_id <> p_user then raise exception 'not_admin'; end if;
  if v.status <> 'waiting' then raise exception 'bad_phase'; end if;
  if v.selected_game <> 'who_am_i' then raise exception 'wrong_game'; end if;
  select * into g from public.games where id = 'who_am_i' and enabled;
  if not found then raise exception 'unknown_game'; end if;
  select count(*) into v_count from public.room_players where room_id = p_room;
  if v_count < g.min_players then raise exception 'too_few'; end if;
  if v_count > g.max_players then raise exception 'too_many'; end if;
  update public.rooms set status = 'playing', active_game = 'who_am_i' where id = p_room;
end;
$$;
revoke execute on function public.wai_activate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.wai_activate(uuid, uuid) to service_role;

-- رجوع الأدمن للغرفة (بعد انتهاء اللعبة أو لو عايز يلغيها): الغرفة ترجع "waiting" ويختار لعبة تانية
create or replace function public.return_to_room(p_room uuid)
returns public.rooms language plpgsql security definer set search_path = ''
as $$
declare v public.rooms;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v from public.rooms where id = p_room for update;
  if not found or v.admin_id <> auth.uid() then raise exception 'not_admin'; end if;
  if v.status <> 'playing' or v.active_game is distinct from 'who_am_i' then raise exception 'bad_phase'; end if;
  delete from public.who_am_i_games where room_id = p_room;
  delete from public.who_am_i_signal where room_id = p_room;
  update public.rooms set status = 'waiting', active_game = null where id = p_room returning * into v;
  return v;
end;
$$;
revoke execute on function public.return_to_room(uuid) from public, anon;
grant execute on function public.return_to_room(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- 4) سجل النقاط العام: يمنع احتساب نفس النقاط مرتين
--    (لعبة الغنا بتفضل تحسب نقاطها بطريقتها القديمة، ومش بتتأثر)
-- ─────────────────────────────────────────────
create table if not exists public.game_point_awards (
  id bigserial primary key,
  game_id text not null references public.games(id),
  room_id uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  award_key text not null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (game_id, award_key, user_id)
);
create index if not exists game_point_awards_user_idx on public.game_point_awards (user_id);
alter table public.game_point_awards enable row level security;
revoke all on public.game_point_awards from anon, authenticated;

-- بتضيف النقاط لـprofiles.total_points مرة واحدة بس لكل (لعبة + مفتاح + لاعب). لو اتكرر الطلب ما بتعمل حاجة.
create or replace function public.award_game_points(p_game text, p_key text, p_room uuid, p_user uuid, p_points integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_id bigint;
begin
  if p_points is null or p_points <= 0 then return false; end if;
  insert into public.game_point_awards (game_id, room_id, user_id, award_key, points)
  values (p_game, p_room, p_user, p_key, p_points)
  on conflict (game_id, award_key, user_id) do nothing
  returning id into v_id;
  if v_id is null then return false; end if;
  update public.profiles set total_points = total_points + p_points where id = p_user;
  return true;
end;
$$;
revoke execute on function public.award_game_points(text, text, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.award_game_points(text, text, uuid, uuid, integer) to service_role;

-- ─────────────────────────────────────────────
-- 5) الدالة القديمة الوحيدة اللي اتعدّلت: handle_player_removed
--    (بتتخطى دور المغني لو لاعب خرج). كانت بتشتغل على آخر جولة غنا مهما كانت اللعبة،
--    فأضفنا شرط واحد: تشتغل في لعبة الغنا بس. باقي الدالة منسوخ حرفياً من 0012.
-- ─────────────────────────────────────────────
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
  if not found or v_room.status <> 'playing' or coalesce(v_room.active_game, 'sing') <> 'sing' then return; end if;
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
