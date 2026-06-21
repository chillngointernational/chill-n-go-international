-- cng-media storage policies — proyecto osbsbrpdwjstvafhzjjj (Chill n Go International)
-- authenticated puede SUBIR (INSERT) y MODIFICAR/BORRAR (UPDATE/DELETE) SOLO sus propios
-- objetos, acotado a bucket_id = 'cng-media'. Scoping por owner (Storage lo setea = auth.uid()
-- en cada upload), independiente de la ruta (messages/, groups/, stories/, {uid}/...).
-- La lectura publica por URL ya existe (bucket publico): NO se crea policy SELECT, asi que
-- nadie puede LISTAR el bucket. anon NO puede subir (policies solo para authenticated).
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.

DROP POLICY IF EXISTS "cng_media_insert_own" ON storage.objects;
CREATE POLICY "cng_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cng-media' AND owner = (select auth.uid()));

DROP POLICY IF EXISTS "cng_media_update_own" ON storage.objects;
CREATE POLICY "cng_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cng-media' AND owner = (select auth.uid()))
  WITH CHECK (bucket_id = 'cng-media' AND owner = (select auth.uid()));

DROP POLICY IF EXISTS "cng_media_delete_own" ON storage.objects;
CREATE POLICY "cng_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cng-media' AND owner = (select auth.uid()));
