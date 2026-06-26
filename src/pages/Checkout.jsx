import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isFullyActive } from '../utils/memberStatus'
import { clientPrice, formatPrice } from '../lib/marketplace'
import { useBuyerAddresses } from '../hooks/useBuyerAddresses'
import { MX_STATES } from '../lib/mxStates'
import { C, FONT, GRADIENT, Icon } from '../stitch'

// Pantalla de checkout (/checkout?listing=&variant=&qty=) — E-4. 🟢 sin dinero: SOLO captura el
// destino, cotiza el envío (cng-shipping-quote) y muestra el total; el COBRO real es E-5.
// Exige login (las órdenes y la libreta necesitan user_id). "Invitado" = logueado sin membresía:
// compra igual (en E-5 pagará por transferencia; el miembro tendrá más métodos + Chilliums).
// SERVER-SIDE: el precio del envío lo resuelve el edge por variant_id; aquí es informativo y E-5
// lo RE-COTIZA antes de cobrar (nunca se confía en el precio que tenga el cliente).

const EMPTY_ADDR = { label: '', contact_name: '', phone: '', email: '', street: '', ext_number: '', int_number: '', district: '', city: '', state: '', postal_code: '', reference: '' }
function digits(s) { return (s || '').replace(/\D/g, '') }

export default function Checkout() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, member, loading: authLoading } = useAuth()

  const listingId = params.get('listing') || ''
  const variantId = params.get('variant') || ''
  const qty = Math.max(1, Math.floor(Number(params.get('qty')) || 1))

  const [product, setProduct] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [loadingProduct, setLoadingProduct] = useState(true)

  const { addresses, loading: addrLoading, reload: reloadAddresses } = useBuyerAddresses(member?.id)
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_ADDR)
  const [savingAddr, setSavingAddr] = useState(false)
  const [addrError, setAddrError] = useState('')

  const [quoting, setQuoting] = useState(false)
  const [options, setOptions] = useState(null)   // null = aún no cotizado; [] = sin opciones
  const [sinCobertura, setSinCobertura] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [selectedShip, setSelectedShip] = useState(null) // índice de la opción elegida

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  // Exigir login (el detalle del producto es público, pero comprar requiere sesión).
  useEffect(() => { if (!authLoading && !user) navigate('/login') }, [authLoading, user, navigate])

  // Cargar producto (lectura pública, solo 'active').
  useEffect(() => {
    let alive = true
    if (!listingId || !variantId) { setLoadingProduct(false); return }
    ;(async () => {
      const { data } = await supabase
        .from('listings')
        .select('id, title, currency, status, store:stores(name, slug), listing_variants(id, price, stock, is_active)')
        .eq('id', listingId).eq('status', 'active').maybeSingle()
      if (!alive) return
      if (data) {
        const v = (data.listing_variants || []).find((x) => x.id === variantId) || (data.listing_variants || [])[0]
        setProduct({ title: data.title, currency: data.currency || 'MXN', store: data.store, price: v?.price != null ? Number(v.price) : null })
      }
      setLoadingProduct(false)
    })()
    return () => { alive = false }
  }, [listingId, variantId])

  useEffect(() => {
    supabase.from('platform_config').select('commission_pct').eq('id', true).maybeSingle().then(({ data }) => setCfg(data || null))
  }, [])

  // Preseleccionar la dirección default (o la única).
  useEffect(() => {
    if (!selectedAddressId && addresses.length) {
      setSelectedAddressId((addresses.find((a) => a.is_default) || addresses[0]).id)
    }
  }, [addresses, selectedAddressId])

  // Cotizar el envío para una dirección. El server resuelve precio/peso/origen por variant_id.
  const runQuote = useCallback(async (addr) => {
    if (!addr || !variantId) return
    setQuoting(true); setOptions(null); setSinCobertura(false); setQuoteError(''); setSelectedShip(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-shipping-quote', {
        body: { variant_id: variantId, quantity: qty, destination: { postal_code: addr.postal_code, city: addr.city, state: addr.state, country: addr.country } },
      })
      if (fnErr) {
        let code = '', msg = 'No se pudo cotizar el envío. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); code = b?.code || ''; if (b?.error) msg = b.error } catch { /* sin cuerpo */ }
        setQuoteError(code === 'producto_sin_datos_envio' ? 'Este producto aún no tiene envío configurado. Vuelve más tarde.' : msg)
        setOptions([]); return
      }
      const opts = data?.options || []
      setOptions(opts); setSinCobertura(!!data?.sin_cobertura)
      if (opts.length) setSelectedShip(0)
    } catch {
      setQuoteError('No se pudo cotizar el envío. Intenta de nuevo.'); setOptions([])
    } finally { setQuoting(false) }
  }, [variantId, qty])

  // Re-cotizar al cambiar la dirección elegida.
  useEffect(() => {
    const addr = addresses.find((a) => a.id === selectedAddressId)
    if (addr) runQuote(addr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddressId])

  function validateAddr() {
    const req = { label: 'la etiqueta', contact_name: 'el nombre de quien recibe', phone: 'el teléfono', street: 'la calle', ext_number: 'el número', district: 'la colonia', city: 'la ciudad', state: 'el estado', postal_code: 'el código postal' }
    for (const [k, name] of Object.entries(req)) {
      if (!String(form[k] || '').trim()) { setAddrError(`Falta ${name}.`); return null }
    }
    if (digits(form.phone).length < 10) { setAddrError('El teléfono debe tener al menos 10 dígitos.'); return null }
    if (!/^[0-9]{5}$/.test(form.postal_code.trim())) { setAddrError('El código postal debe tener 5 dígitos (México).'); return null }
    return {
      label: form.label.trim(), contact_name: form.contact_name.trim(), phone: form.phone.trim(), email: form.email.trim() || null,
      street: form.street.trim(), ext_number: form.ext_number.trim(), int_number: form.int_number.trim() || null,
      district: form.district.trim(), city: form.city.trim(), state: form.state.trim(),
      postal_code: form.postal_code.trim(), reference: form.reference.trim() || null, country: 'MX',
    }
  }

  async function saveAddress() {
    setAddrError('')
    if (!member?.id) { setAddrError('Completa tu perfil antes de comprar.'); return }
    const v = validateAddr()
    if (!v) return
    setSavingAddr(true)
    try {
      const isFirst = addresses.length === 0
      const { data, error: insErr } = await supabase.from('buyer_addresses')
        .insert({ ...v, owner_id: member.id, is_default: isFirst }).select('id').single()
      if (insErr) { setAddrError('No se pudo guardar la dirección. Intenta de nuevo.'); return }
      setAdding(false); setForm(EMPTY_ADDR)
      await reloadAddresses()
      if (data?.id) setSelectedAddressId(data.id) // seleccionarla -> dispara la cotización
    } finally { setSavingAddr(false) }
  }

  // Inicia el pago real: el server RE-COTIZA el envío y crea la orden + checkout de Mercado Pago.
  async function onPay() {
    if (!shipOpt) return
    setPayError(''); setPaying(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cng-mp-create-order', {
        body: {
          listing_id: listingId, variant_id: variantId, quantity: qty,
          shipping_address_id: selectedAddressId,
          carrier: shipOpt.carrier, service: shipOpt.service,
          expected_shipping_cost: Number(shipOpt.price),
        },
      })
      if (fnErr) {
        let code = '', msg = 'No se pudo iniciar el pago. Intenta de nuevo.', newCost = null
        try { const b = await fnErr.context?.json?.(); code = b?.code || ''; if (b?.error) msg = b.error; newCost = b?.new_cost ?? null } catch { /* sin cuerpo */ }
        const addr = addresses.find((a) => a.id === selectedAddressId)
        if (code === 'shipping_price_changed') {
          setPayError(`El costo de envío cambió${newCost != null ? ` a ${formatPrice(newCost, product.currency)}` : ''}. Actualizamos las opciones; confirma de nuevo.`)
          if (addr) runQuote(addr)
        } else if (code === 'shipping_option_unavailable') {
          setPayError('La opción de envío ya no está disponible. Elige otra.')
          if (addr) runQuote(addr)
        } else {
          setPayError(msg)
        }
        return
      }
      if (data?.error) { setPayError(data.error); return }
      if (data?.init_point) { window.location.href = data.init_point; return }
      setPayError('No se pudo iniciar el pago.')
    } catch (e) {
      setPayError(e?.message || 'No se pudo iniciar el pago.')
    } finally {
      setPaying(false)
    }
  }

  // Precios. Producto = base + comisión (clientPrice). Envío = opción elegida. Total = ambos.
  const commissionPct = cfg ? Number(cfg.commission_pct) : null
  const productUnit = clientPrice(product?.price, commissionPct)
  const productTotal = productUnit != null ? productUnit * qty : null
  const shipOpt = (options && selectedShip != null) ? options[selectedShip] : null
  const shipPrice = shipOpt ? Number(shipOpt.price) : null
  const total = (productTotal != null && shipPrice != null) ? productTotal + shipPrice : null
  const isMember = isFullyActive(member)
  const canContinue = !!shipOpt && total != null

  if (authLoading || !user) return <div style={S.center}>Cargando…</div>
  if (loadingProduct) return <div style={S.center}>Cargando…</div>
  if (!product || product.price == null) {
    return (
      <div style={S.center}>
        <div style={S.card}>
          <h1 style={S.notFoundTitle}>Producto no disponible</h1>
          <p style={S.muted}>Este producto ya no se puede comprar.</p>
          <Link to="/app/explore" style={S.primaryBtn}>Explorar GoShop</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <Link to={`/producto/${listingId}`} style={S.back}>← Volver al producto</Link>
        <h1 style={S.title}>Finalizar compra</h1>

        {/* Producto */}
        <section style={S.block}>
          <div style={S.prodRow}>
            <div style={{ minWidth: 0 }}>
              <p style={S.prodTitle}>{product.title}</p>
              {product.store?.name && <p style={S.prodStore}>Vendido por {product.store.name}</p>}
              <p style={S.prodQty}>Cantidad: {qty}</p>
            </div>
            <div style={S.prodPrice}>{productTotal != null ? formatPrice(productTotal, product.currency) : '—'}</div>
          </div>
        </section>

        {/* Dirección de entrega */}
        <section style={S.block}>
          <h2 style={S.secTitle}>Dirección de entrega</h2>
          {addrLoading ? (
            <p style={S.muted}>Cargando direcciones…</p>
          ) : (
            <>
              {addresses.map((a) => (
                <label key={a.id} style={{ ...S.addrRow, ...(selectedAddressId === a.id ? S.addrRowSel : {}) }}>
                  <input type="radio" name="addr" checked={selectedAddressId === a.id} onChange={() => setSelectedAddressId(a.id)} style={{ marginTop: 3 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={S.addrLabel}>{a.label}{a.is_default ? ' · Predeterminada' : ''}</p>
                    <p style={S.addrLine}>{a.contact_name} · {a.phone}</p>
                    <p style={S.addrLine}>{a.street} {a.ext_number}{a.int_number ? ' int. ' + a.int_number : ''} · {a.district} · {a.city}, {a.state} · CP {a.postal_code}</p>
                  </div>
                </label>
              ))}

              {!adding ? (
                <button onClick={() => { setAdding(true); setAddrError('') }} style={S.addBtn}>+ Agregar dirección</button>
              ) : (
                <div style={S.form}>
                  {addrError && <div style={S.error}>{addrError}</div>}
                  <input placeholder="Etiqueta (Casa, Oficina…)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} style={S.input} />
                  <div style={S.row2}>
                    <input placeholder="Quién recibe" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} style={S.input} />
                    <input placeholder="Teléfono (10 díg.)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={S.input} />
                  </div>
                  <div style={S.row2}>
                    <input placeholder="Calle" value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} style={{ ...S.input, flex: 2 }} />
                    <input placeholder="Núm." value={form.ext_number} onChange={(e) => setForm((f) => ({ ...f, ext_number: e.target.value }))} style={S.input} />
                    <input placeholder="Int." value={form.int_number} onChange={(e) => setForm((f) => ({ ...f, int_number: e.target.value }))} style={S.input} />
                  </div>
                  <input placeholder="Colonia" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} style={S.input} />
                  <div style={S.row2}>
                    <input placeholder="Ciudad" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} style={{ ...S.input, flex: 2 }} />
                    <select value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} style={{ ...S.input, flex: 2 }}>
                      <option value="">Estado…</option>
                      {MX_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                    <input placeholder="CP" value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} inputMode="numeric" maxLength={5} style={S.input} />
                  </div>
                  <input placeholder="Referencia (opcional)" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} style={S.input} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={saveAddress} disabled={savingAddr} style={{ ...S.primaryBtn, flex: 1, opacity: savingAddr ? 0.5 : 1 }}>{savingAddr ? 'Guardando…' : 'Guardar y usar'}</button>
                    <button onClick={() => { setAdding(false); setForm(EMPTY_ADDR); setAddrError('') }} disabled={savingAddr} style={S.ghostBtn}>Cancelar</button>
                  </div>
                  <span style={S.hint}>Se guarda en tu libreta para reusarla. País: México (MX).</span>
                </div>
              )}
            </>
          )}
        </section>

        {/* Envío */}
        <section style={S.block}>
          <h2 style={S.secTitle}>Envío</h2>
          {!selectedAddressId ? (
            <p style={S.muted}>Elige o agrega una dirección para cotizar el envío.</p>
          ) : quoting ? (
            <p style={S.muted}>Cotizando envío…</p>
          ) : quoteError ? (
            <div style={S.warn}><Icon name="error_outline" size={16} style={{ color: '#EF9F27', flexShrink: 0, marginTop: 1 }} /><span>{quoteError}</span></div>
          ) : sinCobertura || (options && options.length === 0) ? (
            <div style={S.warn}><Icon name="local_shipping" size={16} style={{ color: '#EF9F27', flexShrink: 0, marginTop: 1 }} /><span>No hay envío disponible a esta zona. Prueba con otra dirección.</span></div>
          ) : (options && options.length > 0) ? (
            <div style={S.shipList}>
              {options.map((o, i) => (
                <label key={i} style={{ ...S.shipRow, ...(selectedShip === i ? S.shipRowSel : {}) }}>
                  <input type="radio" name="ship" checked={selectedShip === i} onChange={() => setSelectedShip(i)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={S.shipName}>{o.carrier_label || o.carrier}{o.service_description ? ` · ${o.service_description}` : ''}</p>
                    {o.delivery_estimate && <p style={S.shipEta}>Entrega: {o.delivery_estimate}</p>}
                  </div>
                  <div style={S.shipPrice}>{formatPrice(Number(o.price), o.currency || product.currency)}</div>
                </label>
              ))}
            </div>
          ) : (
            <p style={S.muted}>Cotizando envío…</p>
          )}
        </section>

        {/* Resumen */}
        <section style={S.block}>
          <h2 style={S.secTitle}>Resumen</h2>
          <div style={S.sumRow}><span>Producto{qty > 1 ? ` (×${qty})` : ''}</span><span>{productTotal != null ? formatPrice(productTotal, product.currency) : '—'}</span></div>
          <div style={S.sumRow}><span>Envío{shipOpt ? ` · ${shipOpt.carrier_label || shipOpt.carrier}` : ''}</span><span>{shipPrice != null ? formatPrice(shipPrice, product.currency) : '—'}</span></div>
          <div style={S.sumTotal}><span>Total</span><span>{total != null ? formatPrice(total, product.currency) : '—'}</span></div>

          <div style={isMember ? S.memberNote : S.guestNote}>
            <Icon name={isMember ? 'auto_awesome' : 'info'} size={15} style={{ color: isMember ? C.primary : C.secondary, flexShrink: 0, marginTop: 1 }} />
            <span>{isMember
              ? 'Como miembro ganarás Chilliums con esta compra.'
              : <>Como invitado pagarás por transferencia o depósito. <Link to="/join" style={S.joinLink}>Hazte miembro</Link> para más opciones y ganar Chilliums.</>}</span>
          </div>

          {payError && <div style={S.error}>{payError}</div>}
          <button onClick={onPay} disabled={!canContinue || paying} style={{ ...S.payBtn, opacity: (canContinue && !paying) ? 1 : 0.5, cursor: (canContinue && !paying) ? 'pointer' : 'not-allowed' }}>
            {paying ? 'Procesando…' : 'Continuar al pago'}
          </button>
          <span style={S.hint}>Pago seguro con Mercado Pago. El envío se recalcula al confirmar.</span>
        </section>
      </div>
    </div>
  )
}

const S = {
  center: { minHeight: '100dvh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT.body, color: C.onSurfaceVariant, fontSize: 14 },
  card: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 340 },
  notFoundTitle: { fontFamily: FONT.headline, fontSize: 20, fontWeight: 800, color: C.text, margin: 0 },

  wrap: { minHeight: '100dvh', background: C.surface, fontFamily: FONT.body },
  inner: { maxWidth: 560, margin: '0 auto', padding: '24px 20px 64px' },
  back: { display: 'inline-block', color: C.onSurfaceVariant, textDecoration: 'none', fontSize: 13, marginBottom: 14 },
  title: { fontSize: 24, fontWeight: 800, color: C.text, fontFamily: FONT.headline, margin: '0 0 18px' },

  block: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16, marginBottom: 14 },
  secTitle: { fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.secondaryDark, fontWeight: 700, margin: '0 0 12px' },
  muted: { fontSize: 13.5, color: C.onSurfaceVariant, margin: 0 },

  prodRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  prodTitle: { fontSize: 15, fontWeight: 700, color: C.text, margin: 0, fontFamily: FONT.headline },
  prodStore: { fontSize: 12.5, color: C.onSurfaceVariant, margin: '3px 0 0' },
  prodQty: { fontSize: 12.5, color: C.onSurfaceVariant, margin: '2px 0 0' },
  prodPrice: { fontSize: 16, fontWeight: 800, color: C.primary, fontFamily: FONT.headline, whiteSpace: 'nowrap' },

  addrRow: { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer' },
  addrRowSel: { borderColor: C.primary, background: 'rgba(104,219,174,0.06)' },
  addrLabel: { fontSize: 13.5, fontWeight: 700, color: C.text, margin: 0 },
  addrLine: { fontSize: 12, color: C.onSurfaceVariant, margin: '3px 0 0', lineHeight: 1.5 },
  addBtn: { background: 'transparent', border: '1px dashed ' + C.outlineVariant, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },

  form: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  row2: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 13px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0 },
  hint: { fontSize: 11.5, color: C.textFaint, lineHeight: 1.4 },

  shipList: { display: 'flex', flexDirection: 'column', gap: 8 },
  shipRow: { display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, cursor: 'pointer' },
  shipRowSel: { borderColor: C.primary, background: 'rgba(104,219,174,0.06)' },
  shipName: { fontSize: 13.5, fontWeight: 700, color: C.text, margin: 0 },
  shipEta: { fontSize: 12, color: C.onSurfaceVariant, margin: '2px 0 0' },
  shipPrice: { fontSize: 14, fontWeight: 800, color: C.primary, whiteSpace: 'nowrap' },

  sumRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: C.onSurface, padding: '6px 0' },
  sumTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: C.text, padding: '10px 0 4px', marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' },
  memberNote: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: C.onSurface, background: 'rgba(104,219,174,0.08)', border: '1px solid rgba(104,219,174,0.2)', borderRadius: 10, padding: '10px 12px', margin: '12px 0', lineHeight: 1.5 },
  guestNote: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: C.onSurface, background: 'rgba(231,192,146,0.08)', border: '1px solid rgba(231,192,146,0.22)', borderRadius: 10, padding: '10px 12px', margin: '12px 0', lineHeight: 1.5 },
  joinLink: { color: C.secondary, fontWeight: 700, textDecoration: 'none' },

  warn: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: C.onSurface, background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.25)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 },
  error: { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: C.error },

  primaryBtn: { display: 'inline-block', textAlign: 'center', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: FONT.body, textDecoration: 'none' },
  ghostBtn: { background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: 'inherit' },
  payBtn: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 14, background: GRADIENT.primary, border: 'none', borderRadius: 12, padding: '15px', fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: FONT.body },
}
