-- idv_one_in_progress (sub-paso 2, refuerzo DB del candado anti-duplicado) — ADITIVA.
-- Garantiza a nivel de base que un usuario tenga A LO MUCHO UNA sesión de verificación
-- EN CURSO (OPEN/VERIFYING). Cierra la carrera (doble clic / dos pestañas) que la
-- validación a nivel de app no puede serializar. Un 2º insert concurrente falla con 23505,
-- que la edge function cng-create-identity-verification maneja (no crea un 2º registro).
CREATE UNIQUE INDEX IF NOT EXISTS uq_idv_one_in_progress
  ON public.identity_verifications (user_id)
  WHERE status IN ('OPEN', 'VERIFYING');
