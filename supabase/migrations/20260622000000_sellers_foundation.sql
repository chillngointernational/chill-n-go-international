-- 1c-1 — Fundación DB del sistema de vendedores (desacoplado de la membresía). ADITIVA.
-- Vender NO requiere membresía; requiere verificación formal de vendedor (INE/fiscal) + cuota.
-- SEGURIDAD: datos fiscales BLINDADOS. Las 3 tablas nuevas son SELECT-self para authenticated
-- y ESCRITURA SOLO service_role (vía edge functions). El cliente NUNCA escribe estado sensible
-- (status, rfc_status, verification_fee_paid, etc.) -> imposible el bypass tipo identity_profiles.

-- ===================== sellers (1 por persona / auth user) =====================
CREATE TABLE IF NOT EXISTS public.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_type text NOT NULL CHECK (seller_type IN ('individual','company')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_verification','verified','rejected')),
  accepted_seller_terms_at timestamptz,
  accepted_seller_terms_version text,
  verification_fee_paid boolean NOT NULL DEFAULT false,   -- ciclo actual pagado con intentos disponibles
  verification_attempts integer NOT NULL DEFAULT 0,        -- intentos usados en el ciclo actual (límite 3)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sellers FROM anon, authenticated;
GRANT SELECT ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;
DROP POLICY IF EXISTS sellers_select_self ON public.sellers;
CREATE POLICY sellers_select_self ON public.sellers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR cng_has_role('admin'));
-- (sin INSERT/UPDATE/DELETE para authenticated -> escritura solo service_role)

-- ===================== seller_fiscal_data (1:1, BLINDADO) =====================
CREATE TABLE IF NOT EXISTS public.seller_fiscal_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE REFERENCES public.sellers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- para RLS directa
  rfc text,
  tax_name text,                 -- razón social / nombre fiscal
  fiscal_regime text,
  cp_fiscal text,
  constancia_url text,           -- ruta en bucket PRIVADO cng-fiscal
  rep_legal_name text,
  rep_legal_rfc text,
  rep_legal_ine_verified boolean NOT NULL DEFAULT false,
  rfc_status text NOT NULL DEFAULT 'pending' CHECK (rfc_status IN ('pending','valid','invalid')),
  rfc_validated_at timestamptz,
  rfc_raw jsonb,
  -- (futuro CFDI/retenciones: se añaden columnas aquí sin rehacer)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seller_fiscal_data ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_fiscal_data FROM anon, authenticated;
GRANT SELECT ON public.seller_fiscal_data TO authenticated;
GRANT ALL ON public.seller_fiscal_data TO service_role;
DROP POLICY IF EXISTS fiscal_select_self ON public.seller_fiscal_data;
CREATE POLICY fiscal_select_self ON public.seller_fiscal_data FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR cng_has_role('admin'));
-- ESCRITURA SOLO service_role: el cliente jamás setea rfc_status / rep_legal_ine_verified / etc.

-- ===================== seller_verification_payments (auditoría de la cuota) =====================
-- Cuota: $249 física / $499 empresa. Cada row 'paid' = un ciclo que otorga 3 intentos.
CREATE TABLE IF NOT EXISTS public.seller_verification_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_type text NOT NULL CHECK (seller_type IN ('individual','company')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  mp_payment_id text,
  attempts_granted integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.seller_verification_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_verification_payments FROM anon, authenticated;
GRANT SELECT ON public.seller_verification_payments TO authenticated;
GRANT ALL ON public.seller_verification_payments TO service_role;
DROP POLICY IF EXISTS svp_select_self ON public.seller_verification_payments;
CREATE POLICY svp_select_self ON public.seller_verification_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR cng_has_role('admin'));

-- ===================== helper =====================
CREATE OR REPLACE FUNCTION public.cng_is_seller_verified()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.sellers WHERE user_id = auth.uid() AND status = 'verified'
  );
$function$;

-- ===================== índices de stores (una tienda por vendedor + slug único) =====================
CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_owner ON public.stores(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_slug ON public.stores(slug);

-- ===================== limpiar las 4 categorías lob=NULL =====================
UPDATE public.categories SET is_active = false WHERE lob IS NULL;

-- ===================== bucket PRIVADO cng-fiscal (constancias) =====================
INSERT INTO storage.buckets (id, name, public) VALUES ('cng-fiscal', 'cng-fiscal', false)
ON CONFLICT (id) DO NOTHING;
-- Políticas: cada quien solo su propia carpeta (name empieza con su uid); service_role bypassa.
DROP POLICY IF EXISTS cng_fiscal_insert_own ON storage.objects;
CREATE POLICY cng_fiscal_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cng-fiscal' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS cng_fiscal_select_own ON storage.objects;
CREATE POLICY cng_fiscal_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cng-fiscal' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS cng_fiscal_update_own ON storage.objects;
CREATE POLICY cng_fiscal_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cng-fiscal' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS cng_fiscal_delete_own ON storage.objects;
CREATE POLICY cng_fiscal_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cng-fiscal' AND (storage.foldername(name))[1] = auth.uid()::text);
