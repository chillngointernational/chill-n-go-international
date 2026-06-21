-- anon_public_feed — abre el FEED a anónimos (SOLO LECTURA, contenido activo) + vista public_profiles.
-- Aditivo y reversible. NO toca las políticas de authenticated ni agrega ninguna escritura para anon.
-- El marketplace ya era legible por anon; aquí solo se abre el feed y los perfiles públicos seguros.

-- 1) Lectura anon del feed (solo contenido activo / vigente). El GRANT de SELECT a anon ya existe.
DROP POLICY IF EXISTS posts_select_anon ON public.cng_posts;
CREATE POLICY posts_select_anon ON public.cng_posts
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS stories_select_anon ON public.cng_stories;
CREATE POLICY stories_select_anon ON public.cng_stories
  FOR SELECT TO anon USING (expires_at > now());

DROP POLICY IF EXISTS post_comments_select_anon ON public.cng_post_comments;
CREATE POLICY post_comments_select_anon ON public.cng_post_comments
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS story_reactions_select_anon ON public.cng_story_reactions;
CREATE POLICY story_reactions_select_anon ON public.cng_story_reactions
  FOR SELECT TO anon USING (true);

-- 2) Perfiles públicos SEGUROS (solo campos no sensibles).
-- La vista corre con privilegios del owner (sin security_invoker) para exponer SOLO estas
-- columnas de perfiles activos a anon, SIN abrir identity_profiles
-- (email / phone / curp / chilliums_* / membership_status / etc. siguen cerrados a anon).
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT user_id, full_name, display_name, avatar_url, ref_code
FROM public.identity_profiles
WHERE is_active = true;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
