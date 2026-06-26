import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchCategories, listingCoverImage, listingMinPrice, formatPrice } from '../lib/marketplace'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Mis productos (/mi-tienda/productos) — el vendedor gestiona los productos de SU tienda.
// Listar/crear/editar/borrar. Guardar SIEMPRE vía rpc_upsert_product (atómico) -> la RLS
// de propietario (cng_owns_store) garantiza que solo toca su propia tienda.
// Imágenes -> bucket cng-store-assets/<user_id>/products/...  (owner-scoped, mismo patrón que el logo).
// Producto simple: 1 variante default (precio/stock), sin UI de variantes. Publica al instante.

const NAME_MIN = 2, NAME_MAX = 80
const IMG_MAX_BYTES = 5 * 1024 * 1024
const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const STATUS_LABEL = { active: 'Publicado', draft: 'Borrador', suspended: 'Suspendido' }
const STATUS_COLOR = { active: C.primary, draft: C.onSurfaceVariant, suspended: C.errorBright }

const EMPTY_FORM = { title: '', description: '', categoryId: '', price: '', stock: '0', images: [], weightKg: '', lengthCm: '', widthCm: '', heightCm: '', originAddressId: '' }

export default function MisProductos() {
  const { user, member, loading: authLoading } = useAuth()
  const fileRef = useRef(null)

  const [checking, setChecking] = useState(true)
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [addresses, setAddresses] = useState([]) // direcciones de origen del vendedor (E-2)

  const [mode, setMode] = useState('list')      // 'list' | 'form'
  const [editing, setEditing] = useState(null)   // listing en edición (o null = crear)
  const [form, setForm] = useState(EMPTY_FORM)

  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // id en confirmación de borrado
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const load = useCallback(async () => {
    if (!user || !member) { setChecking(false); return }
    setChecking(true)
    const [{ data: st }, { data: addr }] = await Promise.all([
      supabase.from('stores').select('id, name, slug, status').eq('owner_id', member.id).maybeSingle(),
      supabase.from('seller_addresses').select('id, label, is_default').eq('owner_id', member.id).order('is_default', { ascending: false }).order('created_at', { ascending: true }),
    ])
    setStore(st || null)
    setAddresses(addr || [])
    if (st) {
      const { data: ls } = await supabase
        .from('listings')
        .select(`
          id, title, description, status, category_id, created_at, origin_address_id,
          listing_variants(id, price, stock, is_active, weight_grams, length_cm, width_cm, height_cm),
          listing_images(id, url, sort_order)
        `)
        .eq('store_id', st.id)
        .order('created_at', { ascending: false })
      setProducts(ls || [])
    }
    setChecking(false)
  }, [user, member])

  useEffect(() => { if (!authLoading) load() }, [authLoading, load])
  useEffect(() => { fetchCategories('store').then(setCategories).catch(() => setCategories([])) }, [])

  // ---- imágenes ----
  async function handleImageSelect(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite re-seleccionar el mismo archivo luego
    if (!files.length || !user) return
    setError('')
    setUploading(true)
    try {
      const added = []
      for (const file of files) {
        if (!IMG_TYPES.includes(file.type)) { setError('Formato no permitido. Usa PNG, JPG, WEBP o GIF.'); continue }
        if (file.size > IMG_MAX_BYTES) { setError('Una imagen pesa más de 5 MB. Usa una más ligera.'); continue }
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('cng-store-assets').upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) { setError('No se pudo subir una imagen. Intenta de nuevo.'); continue }
        const { data: urlData } = supabase.storage.from('cng-store-assets').getPublicUrl(path)
        added.push(urlData.publicUrl)
      }
      if (added.length) setForm((f) => ({ ...f, images: [...f.images, ...added] }))
    } finally {
      setUploading(false)
    }
  }
  function makePrincipal(idx) {
    setForm((f) => { const imgs = [...f.images]; const [it] = imgs.splice(idx, 1); imgs.unshift(it); return { ...f, images: imgs } })
  }
  function removeImage(idx) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))
  }

  // ---- crear / editar ----
  function openCreate() {
    // Preselecciona la dirección de origen predeterminada (o la única) si existe.
    const def = addresses.find((a) => a.is_default) || addresses[0]
    setEditing(null); setForm({ ...EMPTY_FORM, originAddressId: def?.id || '' }); setError(''); setOkMsg(''); setMode('form')
  }
  function openEdit(p) {
    const v = (p.listing_variants || [])[0] || {}
    const imgs = (p.listing_images || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((i) => i.url)
    setEditing(p)
    setForm({
      title: p.title || '',
      description: p.description || '',
      categoryId: p.category_id || '',
      price: v.price != null ? String(v.price) : '',
      stock: v.stock != null ? String(v.stock) : '0',
      images: imgs,
      weightKg: v.weight_grams != null ? String(v.weight_grams / 1000) : '',
      lengthCm: v.length_cm != null ? String(v.length_cm) : '',
      widthCm: v.width_cm != null ? String(v.width_cm) : '',
      heightCm: v.height_cm != null ? String(v.height_cm) : '',
      originAddressId: p.origin_address_id || '',
    })
    setError(''); setOkMsg(''); setMode('form')
  }
  function cancelForm() { setMode('list'); setEditing(null); setForm(EMPTY_FORM); setError('') }

  function validate() {
    const t = form.title.trim()
    if (t.length < NAME_MIN || t.length > NAME_MAX) { setError(`El nombre debe tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`); return null }
    if (!form.categoryId) { setError('Elige una categoría.'); return null }
    const price = Number(form.price)
    if (!Number.isFinite(price) || price <= 0) { setError('El precio debe ser un número mayor a 0.'); return null }
    const stock = form.stock === '' ? 0 : Number(form.stock)
    if (!Number.isInteger(stock) || stock < 0) { setError('El stock debe ser un entero de 0 o más.'); return null }
    if (form.images.length === 0) { setError('Agrega al menos una foto del producto.'); return null }
    const weightKg = Number(form.weightKg)
    if (!Number.isFinite(weightKg) || weightKg <= 0) { setError('El peso (kg) debe ser un número mayor a 0.'); return null }
    const lengthCm = Number(form.lengthCm), widthCm = Number(form.widthCm), heightCm = Number(form.heightCm)
    if (![lengthCm, widthCm, heightCm].every((n) => Number.isFinite(n) && n > 0)) { setError('Largo, ancho y alto (cm) deben ser números mayores a 0.'); return null }
    const weightGrams = Math.round(weightKg * 1000)
    if (weightGrams < 1) { setError('El peso es demasiado bajo.'); return null }
    if (!form.originAddressId) { setError('Elige la dirección de origen del envío.'); return null }
    return { t, price, stock, weightGrams, lengthCm, widthCm, heightCm, originAddressId: form.originAddressId }
  }

  async function handleSave() {
    setError(''); setOkMsg('')
    if (!store?.id) return
    const v = validate()
    if (!v) return
    setSubmitting(true)
    try {
      const { error: rpcErr } = await supabase.rpc('rpc_upsert_product', {
        p_store_id: store.id,
        p_category_id: form.categoryId,
        p_title: v.t,
        p_price: v.price,
        p_stock: v.stock,
        p_description: form.description.trim() || null,
        p_images: form.images,
        p_status: 'active',
        p_listing_id: editing?.id || null,
        p_weight_grams: v.weightGrams,
        p_length_cm: v.lengthCm,
        p_width_cm: v.widthCm,
        p_height_cm: v.heightCm,
        p_origin_address_id: v.originAddressId,
      })
      if (rpcErr) { setError('No se pudo guardar el producto. Intenta de nuevo.'); return }
      setOkMsg(editing ? 'Producto actualizado.' : '¡Producto publicado!')
      setMode('list'); setEditing(null); setForm(EMPTY_FORM)
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    setError(''); setOkMsg(''); setDeleting(true)
    try {
      const { error: delErr } = await supabase.from('listings').delete().eq('id', id)
      if (delErr) { setError('No se pudo borrar el producto.'); return }
      setOkMsg('Producto borrado.')
      setConfirmDelete(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  // ---- render ----
  if (authLoading || checking) {
    return <div style={S.center}>Cargando…</div>
  }
  if (!store) {
    return (
      <div style={S.center}>
        <div style={S.emptyCard}>
          <div style={S.emptyIcon}><Icon name="storefront" size={30} style={{ color: C.onSurfaceVariant }} /></div>
          <h1 style={S.emptyTitle}>Primero crea tu tienda</h1>
          <p style={S.emptyText}>Necesitas una tienda para publicar productos.</p>
          <Link to="/mi-tienda" style={S.primaryBtn}>Ir a Mi Tienda</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <header style={S.header}>
          <Link to="/mi-tienda" style={S.back}>← Mi Tienda</Link>
          <h1 style={S.title}>Mis productos</h1>
          <p style={S.sub}>{store.name}</p>
        </header>

        {error && <div style={S.error}>{error}</div>}
        {okMsg && <div style={S.ok}>{okMsg}</div>}

        {mode === 'list' ? (
          <>
            <div style={S.toolbar}>
              <button onClick={openCreate} style={S.primaryBtn}>+ Agregar producto</button>
            </div>

            {products.length === 0 ? (
              <div style={S.emptyInline}>
                <div style={S.emptyIcon}><Icon name="inventory_2" size={30} style={{ color: C.primary }} /></div>
                <h3 style={S.emptyTitle}>Aún no tienes productos</h3>
                <p style={S.emptyText}>Agrega tu primer producto para que aparezca en tu tienda.</p>
              </div>
            ) : (
              <div style={S.list}>
                {products.map((p) => {
                  const cover = listingCoverImage(p)
                  const price = listingMinPrice(p)
                  return (
                    <div key={p.id} style={S.row}>
                      <div style={S.thumb}>
                        {cover
                          ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Icon name="image" size={22} style={{ color: C.textGhost }} />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={S.rowTitle}>{p.title}</p>
                        <p style={S.rowPrice}>{price != null ? formatPrice(price) : '—'}</p>
                        <span style={{ ...S.badge, color: STATUS_COLOR[p.status] || C.onSurfaceVariant, borderColor: (STATUS_COLOR[p.status] || C.onSurfaceVariant) + '55' }}>
                          {STATUS_LABEL[p.status] || p.status}
                        </span>
                      </div>
                      <div style={S.rowActions}>
                        <button onClick={() => openEdit(p)} style={S.iconBtn} title="Editar"><Icon name="edit" size={18} style={{ color: C.onSurface }} /></button>
                        <button onClick={() => { setConfirmDelete(p.id); setError(''); setOkMsg('') }} style={S.iconBtn} title="Borrar"><Icon name="delete" size={18} style={{ color: C.errorBright }} /></button>
                      </div>

                      {confirmDelete === p.id && (
                        <div style={S.confirm}>
                          <span style={{ fontSize: 13, color: C.onSurface }}>¿Borrar <b>{p.title}</b>? No se puede deshacer.</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleDelete(p.id)} disabled={deleting} style={{ ...S.dangerBtn, opacity: deleting ? 0.5 : 1 }}>{deleting ? 'Borrando…' : 'Sí, borrar'}</button>
                            <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={S.ghostBtn}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div style={S.form}>
            <h2 style={S.formTitle}>{editing ? 'Editar producto' : 'Nuevo producto'}</h2>

            {/* Fotos */}
            <div style={S.field}>
              <label style={S.label}>Fotos del producto</label>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
              {form.images.length > 0 && (
                <div style={S.thumbsGrid}>
                  {form.images.map((url, idx) => (
                    <div key={url + idx} style={S.thumbWrap}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                      {idx === 0 && <span style={S.principalBadge}>Principal</span>}
                      <div style={S.thumbOverlay}>
                        {idx !== 0 && <button type="button" onClick={() => makePrincipal(idx)} style={S.thumbAction} title="Hacer principal"><Icon name="star" size={15} style={{ color: '#fff' }} /></button>}
                        <button type="button" onClick={() => removeImage(idx)} style={S.thumbAction} title="Quitar"><Icon name="close" size={15} style={{ color: '#fff' }} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={S.secondaryBtn}>
                {uploading ? 'Subiendo…' : (form.images.length ? 'Agregar más fotos' : 'Subir fotos')}
              </button>
              <span style={S.hint}>La primera foto es la principal (portada). PNG, JPG, WEBP o GIF · máx 5 MB c/u.</span>
            </div>

            <div style={S.field}>
              <label style={S.label}>Nombre</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={NAME_MAX} style={S.input} placeholder="Ej. Camisa importada USA" />
            </div>

            <div style={S.row2}>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Precio (MXN)</label>
                <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} type="number" min="0" step="0.01" style={S.input} placeholder="0.00" />
              </div>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Stock</label>
                <input value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} type="number" min="0" step="1" style={S.input} placeholder="0" />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Categoría</label>
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} style={S.input}>
                <option value="">Elige una categoría…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={S.field}>
              <label style={S.label}>Descripción (opcional)</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ ...S.input, resize: 'vertical' }} placeholder="Detalles, material, tallas disponibles…" />
            </div>

            {/* Datos de envío (REQUERIDOS: sin origen/peso/dimensiones no se puede cotizar el envío) */}
            <div style={S.field}>
              <label style={S.label}>Datos de envío</label>
              <span style={S.hint}>Necesarios para cotizar el envío. Mide y pesa el paquete ya empacado.</span>

              <div style={{ ...S.field, marginTop: 4 }}>
                <label style={S.subLabel}>Dirección de origen (desde dónde envías)</label>
                {addresses.length === 0 ? (
                  <div style={S.originWarn}>
                    Aún no tienes direcciones de origen. <Link to="/mi-tienda/direcciones" style={S.originLink}>Crea una primero</Link> para poder publicar el producto.
                  </div>
                ) : (
                  <select value={form.originAddressId} onChange={(e) => setForm((f) => ({ ...f, originAddressId: e.target.value }))} style={S.input}>
                    <option value="">Elige una dirección…</option>
                    {addresses.map((a) => <option key={a.id} value={a.id}>{a.label}{a.is_default ? ' (predeterminada)' : ''}</option>)}
                  </select>
                )}
              </div>

              <div style={S.row2}>
                <div style={{ ...S.field, flex: 1 }}>
                  <label style={S.subLabel}>Peso (kg)</label>
                  <input value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} type="number" min="0" step="0.01" style={S.input} placeholder="0.5" />
                </div>
                <div style={{ flex: 1 }} />
              </div>
              <div style={S.row2}>
                <div style={{ ...S.field, flex: 1 }}>
                  <label style={S.subLabel}>Largo (cm)</label>
                  <input value={form.lengthCm} onChange={(e) => setForm((f) => ({ ...f, lengthCm: e.target.value }))} type="number" min="0" step="0.1" style={S.input} placeholder="20" />
                </div>
                <div style={{ ...S.field, flex: 1 }}>
                  <label style={S.subLabel}>Ancho (cm)</label>
                  <input value={form.widthCm} onChange={(e) => setForm((f) => ({ ...f, widthCm: e.target.value }))} type="number" min="0" step="0.1" style={S.input} placeholder="15" />
                </div>
                <div style={{ ...S.field, flex: 1 }}>
                  <label style={S.subLabel}>Alto (cm)</label>
                  <input value={form.heightCm} onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))} type="number" min="0" step="0.1" style={S.input} placeholder="10" />
                </div>
              </div>
            </div>

            <div style={S.formActions}>
              <button onClick={handleSave} disabled={submitting || uploading} style={{ ...S.primaryBtn, flex: 1, opacity: (submitting || uploading) ? 0.5 : 1 }}>
                {submitting ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Publicar producto')}
              </button>
              <button onClick={cancelForm} disabled={submitting} style={S.ghostBtn}>Cancelar</button>
            </div>
          </div>
        )}

        <Link to="/mi-tienda" style={S.bottomLink}>Volver a Mi Tienda</Link>
      </div>
    </div>
  )
}

const S = {
  center: { minHeight: '100dvh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body, color: C.onSurfaceVariant, fontSize: 14 },
  wrap: { minHeight: '100dvh', background: C.surface, fontFamily: FONT.body },
  inner: { maxWidth: 560, margin: '0 auto', padding: '28px 20px 64px' },
  header: { marginBottom: 20 },
  back: { color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13 },
  title: { fontSize: 24, fontWeight: 800, color: C.text, fontFamily: FONT.headline, margin: '12px 0 2px' },
  sub: { fontSize: 13, color: C.onSurfaceVariant, margin: 0 },

  error: { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 14 },
  ok: { background: 'rgba(104,219,174,0.1)', border: '1px solid rgba(104,219,174,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.primary, marginBottom: 14 },

  toolbar: { marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { position: 'relative', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, flexWrap: 'wrap' },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: '#0a0e15', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: 700, color: C.text, margin: 0, fontFamily: FONT.headline, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowPrice: { fontSize: 13, fontWeight: 700, color: C.primary, margin: '2px 0' },
  badge: { fontSize: 10.5, fontWeight: 700, border: '1px solid', borderRadius: 99, padding: '1px 9px', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowActions: { display: 'flex', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  confirm: { width: '100%', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(226,75,74,0.06)', border: '1px solid rgba(226,75,74,0.2)', borderRadius: 10, padding: 12 },

  emptyInline: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '44px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 },
  emptyCard: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 340 },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONT.headline, fontSize: 18, fontWeight: 800, color: C.text, margin: 0 },
  emptyText: { fontSize: 13.5, color: C.onSurfaceVariant, lineHeight: 1.6, margin: 0 },

  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  formTitle: { fontSize: 18, fontWeight: 800, color: C.text, fontFamily: FONT.headline, margin: '0 0 4px' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  row2: { display: 'flex', gap: 12 },
  label: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: 600 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit' },
  hint: { fontSize: 11.5, color: C.textFaint, lineHeight: 1.4 },
  subLabel: { fontSize: 11.5, color: C.textFaint, fontWeight: 600 },
  originWarn: { fontSize: 12.5, color: C.onSurface, background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.25)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 },
  originLink: { color: C.primary, fontWeight: 700, textDecoration: 'none' },

  thumbsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, marginBottom: 4 },
  thumbWrap: { position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' },
  principalBadge: { position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 800, color: '#06140d', background: C.primary, borderRadius: 99, padding: '1px 7px', letterSpacing: 0.3 },
  thumbOverlay: { position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 },
  thumbAction: { width: 24, height: 24, borderRadius: 7, background: 'rgba(0,0,0,0.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

  formActions: { display: 'flex', gap: 10, marginTop: 4 },
  primaryBtn: { display: 'inline-block', textAlign: 'center', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 14.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: FONT.body, textDecoration: 'none' },
  secondaryBtn: { background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' },
  ghostBtn: { background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '13px 18px', fontSize: 13.5, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit' },
  dangerBtn: { background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: C.errorBright, cursor: 'pointer', fontFamily: 'inherit' },
  bottomLink: { display: 'block', textAlign: 'center', color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 24 },
}
