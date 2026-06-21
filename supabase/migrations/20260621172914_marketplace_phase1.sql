-- marketplace_phase1 (sub-paso 1a) — base del marketplace real. ADITIVA y reversible.
-- Agrega: type 'travel', lob, external_url (listings); peso/dimensiones (listing_variants);
-- dirección de origen + envío/recoge (stores); y siembra categorías por LOB.
-- NO toca RLS, feed, activación, membresía ni identity_profiles.

-- 1) listings: comportamiento (type) + sección (lob) + link externo (travel)
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_type_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_type_check
  CHECK (type = ANY (ARRAY['buy_now'::text, 'quote'::text, 'travel'::text]));

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lob text;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_lob_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_lob_check
  CHECK (lob = ANY (ARRAY['store'::text,'store_local'::text,'nutrition'::text,'real_estate'::text,'travel'::text]));

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS external_url text;

-- 2) listing_variants: peso/dimensiones de envío (por variante)
ALTER TABLE public.listing_variants ADD COLUMN IF NOT EXISTS weight_grams integer;
ALTER TABLE public.listing_variants ADD COLUMN IF NOT EXISTS length_cm numeric(8,2);
ALTER TABLE public.listing_variants ADD COLUMN IF NOT EXISTS width_cm  numeric(8,2);
ALTER TABLE public.listing_variants ADD COLUMN IF NOT EXISTS height_cm numeric(8,2);

-- 3) stores: dirección de origen (Envia.com después) + envío/recoge (Store Local)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS origin_address jsonb;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS allows_shipping boolean NOT NULL DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS allows_pickup  boolean NOT NULL DEFAULT false;

-- 4) categorías etiquetadas por LOB (helper de filtrado del form; la verdad del LOB vive en listings.lob)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS lob text;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_lob_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_lob_check
  CHECK (lob IS NULL OR lob = ANY (ARRAY['store'::text,'store_local'::text,'nutrition'::text,'real_estate'::text,'travel'::text]));

-- 5) seed inicial de categorías por LOB (idempotente por slug)
INSERT INTO public.categories (slug, name, lob, default_type, sort_order) VALUES
  ('store-ropa',            'Ropa',                 'store',       'buy_now', 10),
  ('store-calzado',         'Calzado',              'store',       'buy_now', 11),
  ('store-electronica',     'Electrónica y gadgets','store',       'buy_now', 12),
  ('store-hogar',           'Hogar',                'store',       'buy_now', 13),
  ('store-belleza',         'Belleza y cuidado',    'store',       'buy_now', 14),
  ('store-deportes',        'Deportes',             'store',       'buy_now', 15),
  ('store-accesorios',      'Accesorios',           'store',       'buy_now', 16),
  ('local-comida',          'Comida y bebida',      'store_local', 'buy_now', 20),
  ('local-servicios',       'Servicios locales',    'store_local', 'buy_now', 21),
  ('local-artesania',       'Hecho a mano',         'store_local', 'buy_now', 22),
  ('nutricion-suplementos', 'Suplementos',          'nutrition',   'buy_now', 30),
  ('nutricion-proteinas',   'Proteínas',            'nutrition',   'buy_now', 31),
  ('nutricion-vitaminas',   'Vitaminas',            'nutrition',   'buy_now', 32),
  ('nutricion-snacks',      'Snacks saludables',    'nutrition',   'buy_now', 33),
  ('inmuebles-casas',       'Casas',                'real_estate', 'quote',   40),
  ('inmuebles-departamentos','Departamentos',       'real_estate', 'quote',   41),
  ('inmuebles-terrenos',    'Terrenos',             'real_estate', 'quote',   42),
  ('inmuebles-renta',       'Renta',                'real_estate', 'quote',   43),
  ('inmuebles-comercial',   'Oficinas y comercial', 'real_estate', 'quote',   44),
  ('travel-vuelos',         'Vuelos',               'travel',      'travel',  50),
  ('travel-hoteles',        'Hoteles',              'travel',      'travel',  51),
  ('travel-paquetes',       'Paquetes',             'travel',      'travel',  52),
  ('travel-experiencias',   'Experiencias',         'travel',      'travel',  53)
ON CONFLICT (slug) DO NOTHING;
