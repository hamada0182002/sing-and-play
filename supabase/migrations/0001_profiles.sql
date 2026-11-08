-- المرحلة 2: الملفات الشخصية للاعبين
-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query > Run

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 20),
  games_played integer not null default 0,
  wins integer not null default 0,
  total_points integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- اللاعبون المسجلون يرون أسماء بعضهم (لازم داخل الغرف)
create policy "profiles readable by signed-in users"
  on public.profiles for select to authenticated using (true);

-- كل لاعب يعدّل صفه فقط، وعمود الاسم فقط (الإحصائيات يكتبها الخادم لاحقاً)
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- إنشاء الملف الشخصي تلقائياً عند التسجيل
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(left(trim(new.raw_user_meta_data->>'display_name'), 20), ''),
      left(split_part(new.email, '@', 1), 20)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
