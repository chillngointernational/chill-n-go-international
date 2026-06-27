import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Mis ventas (/mi-tienda/ventas) — el VENDEDOR ve sus pedidos y marca como enviados los 'paid'.
// Lee orders + order_items por RLS DIRECTO (orders_select_party / cng_owns_store) — sin RPC nuevo.
// Marcar enviado -> edge cng-mark-shipped (auth: solo el dueño de la store). NO toca dinero ni MP.
// Datos del comprador/envío salen del SNAPSHOT shipping_address (no se expone el perfil del comprador).

const STATUS = {
  pending_payment: { label: 'Esperando pago', color: C.onSurfaceVariant },
  paid:      { label: 'Pagado · por enviar', color: C.primary },
  shipped:   { label: 'Enviado', color: '#EF9F27' },
  delivered: { label: 'Entregado', color: '#EF9F27' },
  completed: { label: 'Completado', color: C.primary },
  refunded:  { label: 'Reembolsado', color: C.errorBright },
  cancelled: { label: 'Cancelado', color: C.onSurfaceVariant },
  disputed:  { label: 'En disputa', color: C.errorBright },
}

function money(n, cur) {
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur || 'MXN' }).format(Number(n || 0)) }
  catch { return `$${Number(n || 0).toFixed(2)}` }
}
function fmtDate(s) {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' }
}

export default function MisVentas() {
  const { user, member, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [store, setStore] = useState(null)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')

  // Form de "marcar enviado" (inline por pedido).
  const [shipForId, setShipForId] = useState(null) // order.id en form
  const [carrier, setCarrier] = useState('')
  const [guide, setGuide] = useState('')
  const [confirming, setConfirming] = useState(false) // diálogo de confirmación
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!user || !member) { setChecking(false); return }
    setChecking(true)
    const { data: st } = await supabase.from('stores')
      .select('id, name, slug, status').eq('owner_id', member.id).maybeSingle()
    setStore(st || null)
    if (st) {
      const { data: ords, error: e } = await supabase
        .from('orders')
        .select(`id, status, subtotal, total, currency, created_at, paid_at, shipped_at, delivered_at,
                 tracking_number, tracking_carrier, shipping_carrier, shipping_service, shipping_cost, shipping_address,
                 order_items(title_snapshot, unit_price, quantity)`)
        .eq('store_id', st.id)
        .order('created_at', { ascending: false })
      if (e) setError('No se pudieron cargar tus ventas.')
      setOrders(ords || [])
    }
    setChecking(false)
  }, [user, member])

  useEffect(() => { if (!authLoading) load() }, [authLoading, load])

  function openShip(order) {
    setError('')
    const addr = order.shipping_address || {}
    setCarrier(addr.carrier_label || order.shipping_carrier || '')
    setGuide('')
    setConfirming(false)
    setShipForId(order.id)
  }
  function closeShip() { setShipForId(null); setConfirming(false); setCarrier(''); setGuide('') }

  async function doShip(orderId) {
    const c = carrier.trim(), g = guide.trim()
    if (!c) { setError('Indica la paquetería.'); return }
    if (!g) { setError('Indica el número de guía.'); return }
    setSubmitting(true); setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-mark-shipped', {
        body: { order_id: orderId, tracking_number: g, tracking_carrier: c },
      })
      if (fnErr) {
        let msg = 'No se pudo marcar como enviado. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error } catch { /* sin cuerpo */ }
        setError(msg); return
      }
      if (data?.error) { setError(data.error); return }
      if (data?.ok) { closeShip(); await load() }
      else setError('Respuesta inesperada del servidor.')
    } catch (e) {
      setError(e?.message || 'No se pudo marcar como enviado.')
    } finally { setSubmitting(false) }
  }

  function renderOrder(o) {
    const st = STATUS[o.status] || { label: o.status, color: C.onSurfaceVariant }
    const a = o.shipping_address || {}
    const cur = o.currency || 'MXN'
    const items = o.order_items || []
    const addrLine = [
      [a.street, a.ext_number].filter(Boolean).join(' '),
      a.int_number ? `int ${a.int_number}` : '',
      a.district, a.city, [a.state, a.postal_code].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ')

    return (
      <div key={o.id} style={S.order}>
        <div style={S.orderTop}>
          <span style={S.orderId}>#{o.id.slice(0, 8)}</span>
          <span style={{ ...S.badge, color: st.color, borderColor: st.color }}>{st.label}</span>
        </div>

        <div style={S.items}>
          {items.map((it, i) => (
            <div key={i} style={S.item}><b>{it.quantity}×</b> {it.title_snapshot} <span style={S.muted}>· {money(it.unit_price, cur)}</span></div>
          ))}
        </div>

        <div style={S.line}><Icon name="person" size={15} style={S.lineIcon} /><span><b>{a.contact_name || '—'}</b>{a.phone ? ` · ${a.phone}` : ''}</span></div>
        {addrLine && <div style={S.line}><Icon name="location_on" size={15} style={S.lineIcon} /><span>{addrLine}</span></div>}
        {a.reference && <div style={S.ref}>Ref: {a.reference}</div>}
        <div style={S.line}><Icon name="local_shipping" size={15} style={S.lineIcon} /><span>{a.carrier_label || o.shipping_carrier || 'Envío'}{a.service_description ? ` · ${a.service_description}` : ''}</span></div>

        <div style={S.money}>
          Total: <b style={{ color: C.text }}>{money(o.total, cur)}</b>
          <span style={S.muted}> (producto {money(o.subtotal, cur)} + envío {money(o.shipping_cost, cur)})</span>
        </div>
        <div style={S.muted}>Tu pago (al liberar): <b style={{ color: C.primary }}>{money(o.subtotal, cur)}</b></div>

        <div style={S.dates}>
          Creado {fmtDate(o.created_at)}{o.paid_at ? ` · Pagado ${fmtDate(o.paid_at)}` : ''}{o.shipped_at ? ` · Enviado ${fmtDate(o.shipped_at)}` : ''}{o.delivered_at ? ` · Entregado ${fmtDate(o.delivered_at)}` : ''}
        </div>

        {o.tracking_number && (
          <div style={S.tracking}><Icon name="qr_code_2" size={15} style={{ ...S.lineIcon, color: C.primary }} />Guía: <b>{o.tracking_carrier} · {o.tracking_number}</b></div>
        )}

        {/* Acción solo para 'paid'. */}
        {o.status === 'paid' && (
          shipForId === o.id ? (
            <div style={S.shipForm}>
              <label style={S.label}>Paquetería</label>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} style={S.input} placeholder="DHL, UPS, Estafeta…" />
              <label style={S.label}>Número de guía</label>
              <input value={guide} onChange={(e) => setGuide(e.target.value)} style={S.input} placeholder="Ej. 1Z999AA10123456784" />
              {!confirming ? (
                <div style={S.btnRow}>
                  <button onClick={() => { if (!carrier.trim() || !guide.trim()) { setError('Completa paquetería y guía.'); return } setError(''); setConfirming(true) }} style={S.primaryBtn}>Marcar como enviado</button>
                  <button onClick={closeShip} style={S.ghostBtn}>Cancelar</button>
                </div>
              ) : (
                <div style={S.confirmBox}>
                  <p style={S.confirmText}>¿Confirmas el envío con <b>{carrier.trim()} · {guide.trim()}</b>? <b>No se puede deshacer.</b></p>
                  <div style={S.btnRow}>
                    <button onClick={() => doShip(o.id)} disabled={submitting} style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }}>{submitting ? 'Marcando…' : 'Sí, marcar enviado'}</button>
                    <button onClick={() => setConfirming(false)} disabled={submitting} style={S.ghostBtn}>Volver</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => openShip(o)} style={S.shipBtn}><Icon name="local_shipping" size={16} style={{ color: '#fff' }} /> Marcar como enviado</button>
          )
        )}
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <Link to="/mi-tienda" style={S.back}>← Mi Tienda</Link>
        <div style={S.headRow}>
          <div style={S.logo}><Icon name="receipt_long" size={18} style={{ color: '#06140d' }} /></div>
          <h1 style={S.title}>Mis ventas</h1>
        </div>

        {error && <div style={S.error}>{error}</div>}

        {(authLoading || checking) ? (
          <p style={S.subtitle}>Cargando…</p>
        ) : !store ? (
          <div style={S.empty}>
            <p style={S.subtitle}>Aún no tienes una tienda. Créala para empezar a vender.</p>
            <Link to="/mi-tienda" style={S.primaryLink}>Ir a Mi Tienda</Link>
          </div>
        ) : orders.length === 0 ? (
          <div style={S.empty}>
            <Icon name="inbox" size={36} style={{ color: C.onSurfaceVariant }} />
            <p style={S.subtitle}>Aún no tienes ventas. Cuando alguien compre tus productos, aparecerán aquí.</p>
            <Link to="/mi-tienda/productos" style={S.ghostLink}>Ver mis productos</Link>
          </div>
        ) : (
          <div style={S.list}>{orders.map(renderOrder)}</div>
        )}

        <Link to="/app/explore" style={S.secondary}>Volver a GoShop</Link>
      </div>
    </div>
  )
}

const S = {
  wrap: { minHeight: '100dvh', background: C.surface, padding: '24px 16px 60px', fontFamily: FONT.body },
  inner: { width: '100%', maxWidth: 600, margin: '0 auto' },
  back: { display: 'inline-block', color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13, marginBottom: 16 },
  headRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 },
  logo: { width: 32, height: 32, borderRadius: 8, background: GRADIENT.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 22, fontWeight: 800, color: C.text, margin: 0, fontFamily: FONT.headline },
  subtitle: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 1.6, margin: '0 0 14px' },
  error: { background: 'rgba(224,49,49,0.1)', border: '1px solid rgba(224,49,49,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 14, textAlign: 'center' },
  empty: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 12px' },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  order: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 16px' },
  orderTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  orderId: { fontSize: 12, color: C.textFaint, fontFamily: 'monospace', letterSpacing: 0.5 },
  badge: { fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, border: '1px solid', whiteSpace: 'nowrap' },
  items: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' },
  item: { fontSize: 14, color: C.onSurface },
  line: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: C.onSurface, lineHeight: 1.5, marginBottom: 4 },
  lineIcon: { color: C.onSurfaceVariant, flexShrink: 0, marginTop: 2 },
  ref: { fontSize: 12, color: C.onSurfaceVariant, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 4, paddingLeft: 23 },
  money: { fontSize: 13.5, color: C.onSurface, marginTop: 8 },
  muted: { fontSize: 12.5, color: C.onSurfaceVariant },
  dates: { fontSize: 11.5, color: C.textFaint, marginTop: 8 },
  tracking: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.onSurface, marginTop: 8, background: 'rgba(104,219,174,0.06)', border: '1px solid rgba(104,219,174,0.18)', borderRadius: 8, padding: '8px 12px' },
  shipBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginTop: 14 },
  shipForm: { marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12.5, color: C.onSurfaceVariant, fontWeight: 600, marginTop: 4 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit' },
  btnRow: { display: 'flex', gap: 10, marginTop: 10 },
  primaryBtn: { flex: 1, background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtn: { background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '12px 18px', fontSize: 14, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit' },
  confirmBox: { background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.25)', borderRadius: 10, padding: '12px 14px', marginTop: 10 },
  confirmText: { fontSize: 13, color: C.onSurface, lineHeight: 1.5, margin: 0 },
  primaryLink: { display: 'inline-block', background: GRADIENT.primary, color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 700 },
  ghostLink: { display: 'inline-block', border: '1px solid ' + C.outlineVariant, color: C.onSurface, textDecoration: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600 },
  secondary: { display: 'block', textAlign: 'center', color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 22 },
}
