import { supabase } from './supabase'

// Líneas de negocio (LOB) del marketplace. La verdad del LOB vive en listings.lob;
// las categorías solo etiquetan y filtran dentro de cada LOB.
export const LOBS = {
  store: { key: 'store', label: 'Store', behavior: 'buy_now' },
  store_local: { key: 'store_local', label: 'Store Local', behavior: 'buy_now' },
  nutrition: { key: 'nutrition', label: 'Nutrition', behavior: 'buy_now' },
  real_estate: { key: 'real_estate', label: 'Real Estate', behavior: 'quote' },
  travel: { key: 'travel', label: 'Travel', behavior: 'travel' },
}

// Categorías activas de un LOB (lectura pública: anónimos incluidos vía RLS).
export async function fetchCategoriesByLob(lob) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, lob, default_type, sort_order')
    .eq('lob', lob)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

// Listings activos de un LOB, con variantes, imágenes, categoría y tienda.
// Lectura pública vía RLS (status='active'). Hoy regresa [] (catálogo vacío).
export async function fetchListingsByLob(lob) {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, title, description, type, lob, currency, external_url, status, created_at,
      category:categories(id, slug, name),
      store:stores(id, name, slug, status),
      listing_variants(id, name, price, stock, is_active),
      listing_images(id, url, sort_order)
    `)
    .eq('lob', lob)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Conteo de listings activos por LOB (para los badges del hub Explore).
export async function countListingsByLob(lob) {
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('lob', lob)
    .eq('status', 'active')
  if (error) throw error
  return count || 0
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
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${value}`
  }
}
