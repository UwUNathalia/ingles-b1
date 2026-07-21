-- Agrega la columna "mastered" (dominada) a progress.
-- Corre esto UNA VEZ en el SQL Editor de Supabase si tu tabla progress
-- ya existía antes de este cambio.
alter table progress add column if not exists mastered boolean not null default false;
