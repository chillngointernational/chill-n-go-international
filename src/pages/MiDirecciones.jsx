import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Mis direcciones de origen (/mi-tienda/direcciones) — el vendedor gestiona desde dónde ENVÍA.
// Varias por vendedor. CRUD directo (RLS owner-only en seller_addresses); marcar default vía
// rpc_set_default_address (atómico). Cada producto elige UNA de estas como su origen (E-2).
// Campos = lo que /ship/rate/ de Envia pide en `origin`. CP MX = 5 dígitos. Borrar una dirección
// EN USO por un producto la bloquea el server (FK ON DELETE RESTRICT).

const COUNTRY = 'MX' // hoy solo México (la cotización y la validación de CP son MX).

const EMPTY = {
  label: '', contact_name: '', phone: '', email: '',
  street: '', ext_number: '', int_number: '',
  district: '', city: '', state: '', postal_code: '', reference: '',
}

function digits(s) { return (s || '').replace(/\D/g, '') }

export default function MiDirecciones() {
  const { user, member, loading: authLoading } = useAuth()

  const [checking, setChecking] = useState(true)
  const [store, setStore] = useState(null)
  const [addresses, setAddresses] = useState([])

  const [mode, setMode] = useState('list')   // 'list' | 'form'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [busyDefault, setBusyDefault] = useState(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const load = useCallback(async () => {
    if (!user || !member) { setChecking(false); return }
    setChecking(true)
    const [{ data: st }, { data: addr }] = await Promise.all([
      supabase.from('stores').select('id, name, status').eq('owner_id', member.id).maybeSingle(),
      supabase.from('seller_addresses').select('*').eq('owner_id', member.id).order('is_default', { ascending: false }).order('created_at', { ascending: true }),
    ])
    setStore(st || null)
    setAddresses(addr || [])
    setChecking(false)
  }, [user, member])

  useEffect(() => { if (!authLoading) load() }, [authLoading, load])

  function openCreate() { setEditing(null); setForm(EMPTY); setError(''); setOkMsg(''); setMode('form') }
  function openEdit(a) {
    setEditing(a)
    setForm({
      label: a.label || '', contact_name: a.contact_name || '', phone: a.phone || '', email: a.email || '',
      street: a.street || '', ext_number: a.ext_number || '', int_number: a.int_number || '',
      district: a.district || '', city: a.city || '', state: a.state || '', postal_code: a.postal_code || '',
      reference: a.reference || '',
    })
    setError(''); setOkMsg(''); setMode('form')
  }
  function cancelForm() { setMode('list'); setEditing(null); setForm(EMPTY); setError('') }

  function validate() {
    const req = { label: 'la etiqueta', contact_name: 'el nombre de contacto', phone: 'el teléfono', street: 'la calle', ext_number: 'el número', district: 'la colonia', city: 'la ciudad', state: 'el estado', postal_code: 'el código postal' }
    for (const [k, name] of Object.entries(req)) {
      if (!String(form[k] || '').trim()) { setError(`Falta ${name}.`); return null }
    }
    if (digits(form.phone).length < 10) { setError('El teléfono debe tener al menos 10 dígitos.'); return null }
    if (!/^[0-9]{5}$/.test(form.postal_code.trim())) { setError('El código postal debe tener 5 dígitos (México).'); return null }
    return {
      owner_id: member.id, country: COUNTRY,
      label: form.label.trim(), contact_name: form.contact_name.trim(), phone: form.phone.trim(),
      email: form.email.trim() || null,
      street: form.street.trim(), ext_number: form.ext_number.trim(), int_number: form.int_number.trim() || null,
      district: form.district.trim(), city: form.city.trim(), state: form.state.trim(),
      postal_code: form.postal_code.trim(), reference: form.reference.trim() || null,
    }
  }

  async function handleSave() {
    setError(''); setOkMsg('')
    const v = validate()
    if (!v) return
    setSubmitting(true)
    try {
      if (editing) {
        const { error: upErr } = await supabase.from('seller_addresses').update(v).eq('id', editing.id)
        if (upErr) { setError('No se pudo guardar la dirección. Intenta de nuevo.'); return }
        setOkMsg('Dirección actualizada.')
      } else {
        const isFirst = addresses.length === 0
        const { error: insErr } = await supabase.from('seller_addresses').insert({ ...v, is_default: isFirst })
        if (insErr) { setError('No se pudo crear la dirección. Intenta de nuevo.'); return }
        setOkMsg('Dirección agregada.')
      }
      setMode('list'); setEditing(null); setForm(EMPTY)
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la dirección.')
    } finally { setSubmitting(false) }
  }

  async function makeDefault(id) {
    setError(''); setOkMsg(''); setBusyDefault(id)
    try {
      const { error: rpcErr } = await supabase.rpc('rpc_set_default_address', { p_address_id: id })
      if (rpcErr) { setError('No se pudo marcar como predeterminada.'); return }
      await load()
    } finally { setBusyDefault(null) }
  }

  async function handleDelete(id) {
    setError(''); setOkMsg(''); setDeleting(true)
    try {
      const { error: delErr } = await supabase.from('seller_addresses').delete().eq('id', id)
      if (delErr) {
        // FK ON DELETE RESTRICT: la dirección está en uso por uno o más productos.
        setError('Esta dirección está en uso por algún producto. Cambia su origen antes de borrarla.')
        setConfirmDelete(null)
        return
      }
      setOkMsg('Dirección borrada.')
      setConfirmDelete(null)
      await load()
    } finally { setDeleting(false) }
  }

  function summaryLine(a) {
    return [
      `${a.street} ${a.ext_number}${a.int_number ? ' int. ' + a.int_number : ''}`,
      a.district, `${a.city}, ${a.state}`, `CP ${a.postal_code}`,
    ].filter(Boolean).join(' · ')
  }

  // ---- render ----
  if (authLoading || checking) return <div style={S.center}>Cargando…</div>
  if (!store) {
    return (
      <div style={S.center}>
        <div style={S.emptyCard}>
          <div style={S.emptyIcon}><Icon name="storefront" size={30} style={{ color: C.onSurfaceVariant }} /></div>
          <h1 style={S.emptyTitle}>Primero crea tu tienda</h1>
          <p style={S.emptyText}>Necesitas una tienda para registrar direcciones de origen.</p>
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
          <h1 style={S.title}>Direcciones de origen</h1>
          <p style={S.sub}>Desde dónde envías tus productos. Cada producto usa una de estas direcciones.</p>
        </header>

        {error && <div style={S.error}>{error}</div>}
        {okMsg && <div style={S.ok}>{okMsg}</div>}

        {mode === 'list' ? (
          <>
            <div style={S.toolbar}>
              <button onClick={openCreate} style={S.primaryBtn}>+ Agregar dirección</button>
            </div>

            {addresses.length === 0 ? (
              <div style={S.emptyInline}>
                <div style={S.emptyIcon}><Icon name="local_shipping" size={30} style={{ color: C.primary }} /></div>
                <h3 style={S.emptyTitle}>Aún no tienes direcciones</h3>
                <p style={S.emptyText}>Agrega tu primera dirección de origen para poder cotizar envíos de tus productos.</p>
              </div>
            ) : (
              <div style={S.list}>
                {addresses.map((a) => (
                  <div key={a.id} style={S.row}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={S.rowTitle}>{a.label}</p>
                        {a.is_default && <span style={S.defaultBadge}>Predeterminada</span>}
                      </div>
                      <p style={S.rowLine}>{a.contact_name} · {a.phone}</p>
                      <p style={S.rowLine}>{summaryLine(a)}</p>
                    </div>
                    <div style={S.rowActions}>
                      <button onClick={() => openEdit(a)} style={S.iconBtn} title="Editar"><Icon name="edit" size={18} style={{ color: C.onSurface }} /></button>
                      <button onClick={() => { setConfirmDelete(a.id); setError(''); setOkMsg('') }} style={S.iconBtn} title="Borrar"><Icon name="delete" size={18} style={{ color: C.errorBright }} /></button>
                    </div>

                    {!a.is_default && (
                      <button onClick={() => makeDefault(a.id)} disabled={busyDefault === a.id} style={S.makeDefaultBtn}>
                        {busyDefault === a.id ? 'Guardando…' : 'Hacer predeterminada'}
                      </button>
                    )}

                    {confirmDelete === a.id && (
                      <div style={S.confirm}>
                        <span style={{ fontSize: 13, color: C.onSurface }}>¿Borrar <b>{a.label}</b>? No se puede deshacer.</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleDelete(a.id)} disabled={deleting} style={{ ...S.dangerBtn, opacity: deleting ? 0.5 : 1 }}>{deleting ? 'Borrando…' : 'Sí, borrar'}</button>
                          <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={S.ghostBtn}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={S.form}>
            <h2 style={S.formTitle}>{editing ? 'Editar dirección' : 'Nueva dirección'}</h2>

            <div style={S.field}>
              <label style={S.label}>Etiqueta</label>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} style={S.input} placeholder="Ej. Bodega Centro" />
              <span style={S.hint}>Solo para identificarla tú (no se muestra al comprador).</span>
            </div>

            <div style={S.row2}>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Nombre de contacto</label>
                <input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} style={S.input} placeholder="Quién entrega" />
              </div>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} type="tel" style={S.input} placeholder="10 dígitos" />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Correo (opcional)</label>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} type="email" style={S.input} placeholder="correo@ejemplo.com" />
            </div>

            <div style={S.row2}>
              <div style={{ ...S.field, flex: 2 }}>
                <label style={S.label}>Calle</label>
                <input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} style={S.input} placeholder="Av. Reforma" />
              </div>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Número</label>
                <input value={form.ext_number} onChange={(e) => setForm((f) => ({ ...f, ext_number: e.target.value }))} style={S.input} placeholder="123" />
              </div>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>Interior</label>
                <input value={form.int_number} onChange={(e) => setForm((f) => ({ ...f, int_number: e.target.value }))} style={S.input} placeholder="opc." />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Colonia</label>
              <input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} style={S.input} placeholder="Colonia / fraccionamiento" />
            </div>

            <div style={S.row2}>
              <div style={{ ...S.field, flex: 2 }}>
                <label style={S.label}>Ciudad / Municipio</label>
                <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={S.input} placeholder="Ciudad" />
              </div>
              <div style={{ ...S.field, flex: 2 }}>
                <label style={S.label}>Estado</label>
                <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} style={S.input} placeholder="Estado" />
              </div>
              <div style={{ ...S.field, flex: 1 }}>
                <label style={S.label}>CP</label>
                <input value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} inputMode="numeric" maxLength={5} style={S.input} placeholder="00000" />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Referencia (opcional)</label>
              <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} style={S.input} placeholder="Entre calles, color de fachada…" />
            </div>

            <div style={S.cpHint}>País: <b style={{ color: C.onSurface }}>México (MX)</b> · por ahora solo se envía dentro de México.</div>

            <div style={S.formActions}>
              <button onClick={handleSave} disabled={submitting} style={{ ...S.primaryBtn, flex: 1, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Agregar dirección')}
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
  sub: { fontSize: 13, color: C.onSurfaceVariant, margin: 0, lineHeight: 1.5 },

  error: { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 14 },
  ok: { background: 'rgba(104,219,174,0.1)', border: '1px solid rgba(104,219,174,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.primary, marginBottom: 14 },

  toolbar: { marginBottom: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, flexWrap: 'wrap' },
  rowTitle: { fontSize: 14.5, fontWeight: 700, color: C.text, margin: 0, fontFamily: FONT.headline },
  rowLine: { fontSize: 12.5, color: C.onSurfaceVariant, margin: '3px 0 0', lineHeight: 1.5 },
  defaultBadge: { fontSize: 10, fontWeight: 800, color: '#06140d', background: C.primary, borderRadius: 99, padding: '1px 8px', letterSpacing: 0.3 },
  rowActions: { display: 'flex', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  makeDefaultBtn: { width: '100%', marginTop: 2, background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 9, padding: '8px', fontSize: 12.5, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit' },
  confirm: { width: '100%', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(226,75,74,0.06)', border: '1px solid rgba(226,75,74,0.2)', borderRadius: 10, padding: 12 },

  emptyInline: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '44px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 },
  emptyCard: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 340 },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONT.headline, fontSize: 18, fontWeight: 800, color: C.text, margin: 0 },
  emptyText: { fontSize: 13.5, color: C.onSurfaceVariant, lineHeight: 1.6, margin: 0 },

  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  formTitle: { fontSize: 18, fontWeight: 800, color: C.text, fontFamily: FONT.headline, margin: '0 0 4px' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  row2: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  label: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: 600 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit', minWidth: 0 },
  hint: { fontSize: 11.5, color: C.textFaint, lineHeight: 1.4 },
  cpHint: { fontSize: 12, color: C.onSurfaceVariant, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' },

  formActions: { display: 'flex', gap: 10, marginTop: 4 },
  primaryBtn: { display: 'inline-block', textAlign: 'center', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 14.5, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: FONT.body, textDecoration: 'none' },
  ghostBtn: { background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '13px 18px', fontSize: 13.5, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit' },
  dangerBtn: { background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: C.errorBright, cursor: 'pointer', fontFamily: 'inherit' },
  bottomLink: { display: 'block', textAlign: 'center', color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 24 },
}
