-- ============================================================
-- Migration: quitar 'candystakes' del CHECK de cng_posts.category
-- Generada: 2026-06-15 (UTC)
-- Estado: PENDIENTE DE REVISIÓN — NO APLICADA A LA BASE DE DATOS
-- Motivo: el modelo nuevo elimina CandyStakes (producto de inversión).
--         El CHECK actual todavía admite la categoría 'candystakes'.
-- Alcance: SOLO schema. No toca webhook, ledger de Chilliums ni referidos.
-- ============================================================
--
-- Estado actual del constraint (inline en el CREATE TABLE de cng_posts):
--   category text DEFAULT 'general'
--     CHECK (category IN (
--       'travel','nutrition','store','realestate','candystakes','online','general'
--     ))
--
-- ────────────────────────────────────────────────────────────
-- IMPORTANTE — datos existentes (leer antes de aplicar)
-- ────────────────────────────────────────────────────────────
-- Si existen filas en cng_posts con category = 'candystakes', el nuevo CHECK
-- FALLARÍA al crearse. Por eso el Paso 1 reasigna esas filas ANTES del ALTER.
--
-- Cuántas filas se verían afectadas (correr antes; sólo lectura):
--   SELECT count(*) FROM public.cng_posts WHERE category = 'candystakes';
--
-- Opciones para esas filas (el Paso 1 usa la opción A por defecto):
--   A) Reasignar a 'general'  → los posts siguen visibles, recategorizados. (default)
--   B) Reasignar a 'store'    → si tiene más sentido de negocio: cambia 'general' por 'store'.
--   C) Eliminarlas            → en vez del UPDATE del Paso 1:
--        DELETE FROM public.cng_posts WHERE category = 'candystakes';
--   Nota: ocultar con is_active=false NO basta por sí solo — la fila seguiría
--   teniendo category='candystakes' y el ADD CONSTRAINT fallaría. Hay que
--   reasignar (A/B) o eliminar (C).
--
-- ────────────────────────────────────────────────────────────
-- NOTA — nombre del constraint
-- ────────────────────────────────────────────────────────────
-- El CHECK es inline (sin nombre explícito), así que Postgres lo nombró
-- automáticamente. El nombre estándar es 'cng_posts_category_check'.
-- Verifícalo antes de aplicar con:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.cng_posts'::regclass AND contype = 'c';
-- Si difiere, ajusta el DROP CONSTRAINT de abajo.
-- ============================================================

BEGIN;

-- Paso 1 — Reasignar posts existentes para no romper el nuevo CHECK.
--          (ver opciones A/B/C en las notas de arriba)
UPDATE public.cng_posts
   SET category = 'general'
 WHERE category = 'candystakes';

-- Paso 2 — Reemplazar el CHECK dejando solo las categorías del modelo nuevo.
ALTER TABLE public.cng_posts
  DROP CONSTRAINT IF EXISTS cng_posts_category_check;

ALTER TABLE public.cng_posts
  ADD CONSTRAINT cng_posts_category_check
  CHECK (category IN (
    'travel', 'nutrition', 'store', 'realestate', 'online', 'general'
  ));

COMMIT;

-- ────────────────────────────────────────────────────────────
-- Rollback (revertir el constraint a su estado previo)
-- ────────────────────────────────────────────────────────────
-- ALTER TABLE public.cng_posts DROP CONSTRAINT IF EXISTS cng_posts_category_check;
-- ALTER TABLE public.cng_posts
--   ADD CONSTRAINT cng_posts_category_check
--   CHECK (category IN (
--     'travel','nutrition','store','realestate','candystakes','online','general'
--   ));
-- (El rollback NO restaura las categorías de los posts reasignados en el Paso 1.)
