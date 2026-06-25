import { supabase } from './supabase'

// Líneas de negocio (LOB) del marketplace unificado (GoShop). La verdad del LOB
// vive en listings.lob; en la vista única los LOB son FILTROS, no secciones.
export const LOBS = {
  store: { key: 'store', label: 'Store', behavior: 'buy_now' },
  store_local: { key: 'store_local', label: 'Store Local', behavior: 'buy_now' },
  nutrition: { key: 'nutrition', label: 'Nutrition', behavior: 'buy_now' },
  real_estate: { key: 'real_estate', label: 'Real Estate', behavior: 'quote' },
  travel: { key: 'travel', label: 'Travel', behavior: 'travel' },
}

// Categorías activas. Sin lob => TODAS (vista unificada); con lob => solo ese LOB.
// Lectura pública (anónimos incluidos) vía RLS.
export async function fetchCategories(lob) {
  let query = supabase
    .from('categories')
    .select('id, slug, name, lob, default_type, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (lob) query = query.eq('lob', lob)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// Listings activos con variantes, imágenes, categoría y tienda.
// Sin lob => TODOS mezclados (catálogo unificado); con lob => solo ese LOB.
// Lectura pública vía RLS (status='active'). Hoy regresa [] (catálogo vacío).
export async function fetchListings(lob) {
  let query = supabase
    .from('listings')
    .select(`
      id, title, description, type, lob, currency, external_url, status, created_at,
      category:categories(id, slug, name),
      store:stores(id, name, slug, status),
      listing_variants(id, name, price, stock, is_active),
      listing_images(id, url, sort_order)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (lob) query = query.eq('lob', lob)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// Precio mínimo entre variantes activas con precio (null si no hay).
export function listingMinPrice(listing) {
  const prices = (listing?.listing_variants || [])
    .filter((v) => v.is_active && v.price != null)
    .map((v) => Number(v.price))
  return prices.length ? Math.min(...prices) : null
}

// Primera imagen por sort_order (null si no hay).
export function listingCoverImage(listing) {
  const imgs = (listing?.listing_images || []).slice().sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
  return imgs[0]?.url || null
}

export function formatPrice(value, currency = 'MXN') {
  if (value == null) return null
  try {
    // Formato de dinero normal: SIEMPRE 2 decimales ($110.00, $109.99, $250.50).
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `$${Number(value).toFixed(2)}`
  }
}

// Precio FINAL que VE el cliente = precio base × (1 + commission_pct/100). La comisión se suma
// ENCIMA (el vendedor recibe su precio base; el comprador paga el final). commission_pct viene de
// platform_config (nunca hardcodeado -> si cambia en /admin, todos los precios al cliente cambian).
// Devuelve null si falta el dato (base o comisión) -> la UI muestra un placeholder en vez de un
// precio incorrecto (nunca el base "sin comisión" en una vista de cliente).
export function clientPrice(basePrice, commissionPct) {
  if (basePrice == null) return null
  const pct = Number(commissionPct)
  if (commissionPct == null || !Number.isFinite(pct)) return null
  return Number(basePrice) * (1 + pct / 100)
}
