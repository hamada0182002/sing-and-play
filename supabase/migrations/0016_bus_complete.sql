-- المرحلة 16: لعبة «أتوبيس كومبليت»
-- شغّل هذا الملف كاملاً مرة واحدة: Supabase > SQL Editor > New query > Run. آمن للتكرار.
-- مفيش أي جدول أو دالة قديمة بتتعدّل أو بتتحذف. بيعتمد على جداول المنصة الموجودة (rooms, room_players, profiles, games, game_point_awards, award_game_points).

-- 1) تسجيل اللعبة في سجل الألعاب (يظهر للأدمن في اختيار اللعبة)
insert into public.games (id, title, min_players, max_players, sort_order) values
  ('bus_complete', 'أتوبيس كومبليت', 3, 10, 3)
on conflict (id) do nothing;

-- 2) حالة اللعبة (فيها الإجابات والقاموس المتعلَّم) — مقفولة تماماً: الـEdge Function فقط (مفتاح الخدمة)
create table if not exists public.bus_complete_games (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.bus_complete_games enable row level security;
revoke all on public.bus_complete_games from anon, authenticated;

-- 3) «إشارة» لحظية بس (رقم نسخة من غير أي أسرار): لما يتغيّر كل لاعب يطلب نسخته الآمنة
create table if not exists public.bus_complete_signal (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.bus_complete_signal enable row level security;
drop policy if exists "bus_complete signal readable by room members" on public.bus_complete_signal;
create policy "bus_complete signal readable by room members"
  on public.bus_complete_signal for select to authenticated using (public.is_room_member(room_id));
revoke insert, update, delete on public.bus_complete_signal from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bus_complete_signal') then
    alter publication supabase_realtime add table public.bus_complete_signal;
  end if;
end $$;

-- 4) تفعيل اللعبة للغرفة (الخادم فقط): بتتأكد من الأدمن والحالة واللعبة المختارة وعدد اللاعبين وتقلب الغرفة لـ playing في خطوة واحدة
create or replace function public.bc_activate(p_room uuid, p_user uuid)
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
  if v.selected_game <> 'bus_complete' then raise exception 'wrong_game'; end if;
  select * into g from public.games where id = 'bus_complete' and enabled;
  if not found then raise exception 'unknown_game'; end if;
  select count(*) into v_count from public.room_players where room_id = p_room;
  if v_count < g.min_players then raise exception 'too_few'; end if;
  if v_count > g.max_players then raise exception 'too_many'; end if;
  delete from public.bus_complete_games where room_id = p_room;      -- بداية نظيفة لكل مرة تتفعّل فيها
  update public.rooms set status = 'playing', active_game = 'bus_complete' where id = p_room;
end;
$$;
revoke execute on function public.bc_activate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bc_activate(uuid, uuid) to service_role;

-- 5) رجوع الأدمن للغرفة (بعد النتيجة النهائية أو لو عايز يلغي): الغرفة ترجع waiting ويختار لعبة تانية
create or replace function public.bc_return_to_room(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v public.rooms;
begin
  select * into v from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if v.admin_id <> p_user then raise exception 'not_admin'; end if;
  if v.status <> 'playing' or v.active_game is distinct from 'bus_complete' then raise exception 'bad_phase'; end if;
  delete from public.bus_complete_games where room_id = p_room;
  delete from public.bus_complete_signal where room_id = p_room;
  update public.rooms set status = 'waiting', active_game = null where id = p_room;
end;
$$;
revoke execute on function public.bc_return_to_room(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bc_return_to_room(uuid, uuid) to service_role;
