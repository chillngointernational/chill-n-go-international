-- Social hardening — proyecto osbsbrpdwjstvafhzjjj (Chill n Go International)
-- A) Dedup de triggers de contadores (1 por accion) + funciones huerfanas
-- B) Resync de contadores desde la verdad
-- C) Revoca TRUNCATE/DELETE de anon en todo el esquema public

-- ===== PARTE A: triggers duplicados =====
-- cng_messages (AFTER INSERT): conservar on_new_message -> handle_new_message
DROP TRIGGER IF EXISTS trg_cng_new_message ON public.cng_messages;
DROP FUNCTION IF EXISTS public.fn_cng_new_message();

-- cng_post_likes (AFTER INSERT/DELETE): conservar familia fn_cng_post_likes_counter
DROP TRIGGER IF EXISTS trg_likes_increment ON public.cng_post_likes;
DROP TRIGGER IF EXISTS trg_likes_decrement ON public.cng_post_likes;
DROP FUNCTION IF EXISTS public.fn_increment_likes();
DROP FUNCTION IF EXISTS public.fn_decrement_likes();

-- cng_post_comments (AFTER INSERT/DELETE): conservar familia fn_cng_post_comments_counter
DROP TRIGGER IF EXISTS trg_comments_increment ON public.cng_post_comments;
DROP TRIGGER IF EXISTS trg_comments_decrement ON public.cng_post_comments;
DROP FUNCTION IF EXISTS public.fn_increment_comments();
DROP FUNCTION IF EXISTS public.fn_decrement_comments();

-- ===== PARTE A.3: resync de contadores (desde la verdad) =====
UPDATE public.cng_posts p
SET likes_count = (SELECT count(*) FROM public.cng_post_likes l WHERE l.post_id = p.id)
WHERE p.likes_count IS DISTINCT FROM
      (SELECT count(*) FROM public.cng_post_likes l WHERE l.post_id = p.id);

UPDATE public.cng_posts p
SET comments_count = (SELECT count(*) FROM public.cng_post_comments c WHERE c.post_id = p.id)
WHERE p.comments_count IS DISTINCT FROM
      (SELECT count(*) FROM public.cng_post_comments c WHERE c.post_id = p.id);

UPDATE public.cng_conversation_members cm
SET unread_count = (
  SELECT count(*) FROM public.cng_messages m
  WHERE m.conversation_id = cm.conversation_id
    AND m.sender_id <> cm.user_id
    AND m.is_deleted = false
    AND m.created_at > GREATEST(
          COALESCE(cm.last_read_at, cm.joined_at, '-infinity'::timestamptz),
          COALESCE(cm.cleared_at, '-infinity'::timestamptz)))
WHERE cm.unread_count IS DISTINCT FROM (
  SELECT count(*) FROM public.cng_messages m
  WHERE m.conversation_id = cm.conversation_id
    AND m.sender_id <> cm.user_id
    AND m.is_deleted = false
    AND m.created_at > GREATEST(
          COALESCE(cm.last_read_at, cm.joined_at, '-infinity'::timestamptz),
          COALESCE(cm.cleared_at, '-infinity'::timestamptz)));

-- ===== PARTE B: revocar TRUNCATE y DELETE de anon en todo public =====
REVOKE TRUNCATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
