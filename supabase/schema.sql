-- Ingles B1 - esquema de base de datos para Supabase
-- Pega TODO este archivo en: Supabase Dashboard > SQL Editor > New query > Run

-- Tabla de palabras (el "mazo" compartido, organizado por semana)
create table if not exists words (
  id bigint generated always as identity primary key,
  week int not null,
  section text not null default '',
  en text not null,
  es text not null,
  created_at timestamptz not null default now()
);

-- Tabla de progreso por usuario (algoritmo estilo SM-2 / Anki, con pasos en minutos)
-- stage: 'new' (nunca repasada) -> 'step1' (aprendiendo, minutos) -> 'review' (repaso por días)
create table if not exists progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id bigint not null references words(id) on delete cascade,
  stage text not null default 'new',
  ease numeric not null default 2.5,
  interval_days numeric not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed timestamptz,
  mastered boolean not null default false,
  unique (user_id, word_id)
);

alter table words enable row level security;
alter table progress enable row level security;

-- Cualquier usuario logueado puede LEER las palabras (no puede editarlas desde la app)
drop policy if exists "words_select_authenticated" on words;
create policy "words_select_authenticated"
  on words for select
  to authenticated
  using (true);

-- Cada usuario solo puede ver/crear/editar SU PROPIO progreso
drop policy if exists "progress_select_own" on progress;
create policy "progress_select_own"
  on progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "progress_insert_own" on progress;
create policy "progress_insert_own"
  on progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "progress_update_own" on progress;
create policy "progress_update_own"
  on progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
