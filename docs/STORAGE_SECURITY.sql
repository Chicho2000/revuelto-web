-- REVUELTO / SUPABASE STORAGE
-- Ejecutar manualmente en SQL Editor después de revisar el resultado de la
-- auditoría. La aplicación no ejecuta ni aplica estas políticas.

-- 1) Verificar los buckets reales. Configurarlos desde Storage > Buckets:
--    revuelto-temp: privado, 5 MB, image/jpeg,image/png,image/webp
--    bucket-media:  público, 5 MB, image/jpeg,image/png,image/webp
-- Auditoría read-only 2026-08-10: revuelto-temp estaba en 10 MB y
-- bucket-media permitía solo image/webp. Cambiar esos dos valores en Dashboard;
-- no actualizar directamente las tablas internas del schema storage.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('revuelto-temp', 'bucket-media')
order by id;

-- 2) Auditar TODAS las políticas de objetos. Una política PERMISSIVE que
--    conceda SELECT/INSERT/UPDATE/DELETE a public, anon o authenticated y que
--    pueda alcanzar cualquiera de estos buckets debe eliminarse.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- Auditoría read-only 2026-08-10: pg_policies no devolvió filas para
-- storage.objects; hoy no existe ninguna política permisiva que eliminar.

-- 3) Defensa en profundidad opcional. Estas políticas RESTRICTIVE bloquean todo acceso
--    directo de anon/authenticated a los objetos de ambos buckets, aunque
--    exista por error otra política permisiva amplia.
--
--    No bloquean la service role (bypassa RLS), la subida a la URL firmada de
--    un objeto concreto ni la entrega por URL pública de bucket-media.
drop policy if exists "revuelto_temp_deny_direct_access" on storage.objects;
create policy "revuelto_temp_deny_direct_access"
on storage.objects
as restrictive
for all
to anon, authenticated
using (bucket_id <> 'revuelto-temp')
with check (bucket_id <> 'revuelto-temp');

drop policy if exists "revuelto_media_deny_direct_access" on storage.objects;
create policy "revuelto_media_deny_direct_access"
on storage.objects
as restrictive
for all
to anon, authenticated
using (bucket_id <> 'bucket-media')
with check (bucket_id <> 'bucket-media');

-- 4) Verificación exacta posterior. Deben aparecer las dos políticas como
--    RESTRICTIVE / ALL / {anon,authenticated}.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'revuelto_temp_deny_direct_access',
    'revuelto_media_deny_direct_access'
  )
order by policyname;

-- Para eliminar una política permisiva detectada en el paso 2, usar el nombre
-- exacto que devolvió la consulta (no copiar un placeholder):
-- drop policy "NOMBRE EXACTO DEVUELTO POR pg_policies" on storage.objects;
