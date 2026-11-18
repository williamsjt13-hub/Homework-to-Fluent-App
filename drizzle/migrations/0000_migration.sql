
create table public.profiles (
  id uuid primary key,
  display_name text,
  target_language text not null default 'es',
  native_language text not null default 'en',
  level text not null default 'beginner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.user_settings (
  user_id uuid primary key,
  daily_goal_minutes int not null default 60,
  speech_rate numeric not null default 0.9,
  voice_accent text not null default 'es-ES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.user_settings to authenticated;
grant all on public.user_settings to service_role;
alter table public.user_settings enable row level security;
create policy "own settings all" on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.weekly_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  language text not null default 'es',
  status text not null default 'uploaded',
  topic text,
  extracted jsonb,
  week_start date not null default current_date,
  overall_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid not null references public.weekly_lessons(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  page_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.study_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid not null references public.weekly_lessons(id) on delete cascade,
  day_number int not null,
  title text not null,
  purpose text not null,
  target_minutes int not null default 60,
  minutes_completed int not null default 0,
  score numeric,
  content_status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lesson_id, day_number)
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid not null references public.weekly_lessons(id) on delete cascade,
  day_id uuid not null references public.study_days(id) on delete cascade,
  position int not null default 0,
  kind text not null,
  title text not null,
  description text,
  source text not null default 'ai',
  est_minutes int not null default 10,
  content jsonb not null default '{}'::jsonb,
  answers jsonb,
  results jsonb,
  score numeric,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.student_mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid references public.weekly_lessons(id) on delete cascade,
  concept text not null,
  category text not null default 'grammar',
  student_text text,
  correct_text text,
  explanation text,
  source text not null default 'homework',
  occurrences int not null default 1,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid references public.weekly_lessons(id) on delete cascade,
  language text not null default 'es',
  term text not null,
  translation text,
  times_correct int not null default 0,
  times_missed int not null default 0,
  created_at timestamptz not null default now()
);
create table public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid not null references public.weekly_lessons(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  scenario jsonb,
  messages jsonb not null default '[]'::jsonb,
  evaluation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid references public.weekly_lessons(id) on delete cascade,
  day_id uuid references public.study_days(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  minutes int not null,
  study_date date not null default current_date,
  created_at timestamptz not null default now()
);
create table public.weekly_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lesson_id uuid not null references public.weekly_lessons(id) on delete cascade,
  total_score numeric not null,
  category_scores jsonb not null default '{}'::jsonb,
  weak_areas jsonb not null default '[]'::jsonb,
  strong_areas jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['weekly_lessons','uploaded_documents','study_days','activities','student_mistakes','vocabulary','conversation_sessions','study_sessions','weekly_assessments'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create index on public.%I (user_id)', t);
  end loop;
end $$;

create policy "own homework read" on storage.objects for select to authenticated using (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own homework insert" on storage.objects for insert to authenticated with check (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own homework delete" on storage.objects for delete to authenticated using (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);
