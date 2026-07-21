-- Arregla "permission denied for table words" / "...for table progress".
-- Las políticas de RLS ya existen, pero a los roles anon/authenticated les
-- falta el permiso base de PostgreSQL sobre las tablas. Corre esto una vez.
grant usage on schema public to anon, authenticated;

grant select on words to anon, authenticated;
grant select, insert, update on progress to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;
