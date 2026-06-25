import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../../stitch'

// Sección "Configuración de pagos" del panel /admin (C-2). SOLO config, sin dinero.
// Lee platform_config (lectura pública por RLS) y guarda vía rpc_admin_set_config
// (SECURITY DEFINER auto-gateado con cng_is_admin -> un no-admin no puede escribir).
// checkout_live es el KILL-SWITCH del dinero real: ON activa el cobro real (cuando
// existan C-3/C-4) y requiere luz verde de contador/abogado.

export default function PaymentConfig() {
  const [loading, setLoading] = useState(true)
  const [commission, setCommission] = useState('')
  const [cushion, setCushion] = useState('')
  const [holdDays, setHoldDays] = useState('')
  const [live, setLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('platform_config')
      .select('commission_pct, cushion_pct, hold_days, checkout_live')
      .eq('id', true)
      .maybeSingle()
    if (data) {
      setCommission(String(data.commission_pct))
      setCushion(String(data.cushion_pct))
      setHoldDays(String(data.hold_days))
      setLive(!!data.checkout_live)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function validate() {
    const c = Number(commission), k = Number(cushion), h = Number(holdDays)
    if (!Number.isFinite(c) || c < 0 || c > 100) { setError('La comisión debe estar entre 0 y 100.'); return null }
    if (!Number.isFinite(k) || k < 0 || k > 100) { setError('El colchón debe estar entre 0 y 100.'); return null }
    if (!Number.isInteger(h) || h < 0) { setError('La retención (días) debe ser un entero ≥ 0.'); return null }
    return { c, k, h }
  }

  async function handleSave() {
    setError(''); setOkMsg('')
    const v = validate()
    if (!v) return
    setSaving(true)
    try {
      const { error: rpcErr } = await supabase.rpc('rpc_admin_set_config', {
        p_commission_pct: v.c,
        p_cushion_pct: v.k,
        p_hold_days: v.h,
        p_checkout_live: live,
      })
      if (rpcErr) { setError('No se pudo guardar la configuración.'); return }
      setOkMsg('Configuración guardada.')
      await load()
    } catch (e) {
      setError(e?.message || 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  // Chilliums = comisión − colchón (del 100% de la comisión). Previsualización.
  const chilliumsShare = Math.max(0, 100 - (Number(cushion) || 0))

  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={S.secTitle}>Configuración de pagos</h2>

      {error && <div style={S.error}>{error}</div>}
      {okMsg && <div style={S.ok}>{okMsg}</div>}

      {loading ? (
        <p style={S.muted}>Cargando…</p>
      ) : (
        <div style={S.card}>
          <div style={S.field}>
            <label style={S.label}>Comisión de plataforma (%)</label>
            <input value={commission} onChange={(e) => setCommission(e.target.value)} type="number" min="0" max="100" step="0.1" style={S.input} />
            <span style={S.hint}>Se suma encima del precio del vendedor (el vendedor recibe su precio íntegro).</span>
          </div>

          <div style={S.field}>
            <label style={S.label}>Colchón (% de la comisión)</label>
            <input value={cushion} onChange={(e) => setCushion(e.target.value)} type="number" min="0" max="100" step="0.1" style={S.input} />
            <span style={S.hint}>El resto de la comisión va a Chilliums. Hoy: <b style={{ color: C.primary }}>{chilliumsShare}%</b> a Chilliums, {Number(cushion) || 0}% colchón.</span>
          </div>

          <div style={S.field}>
            <label style={S.label}>Retención del pago al vendedor (días)</label>
            <input value={holdDays} onChange={(e) => setHoldDays(e.target.value)} type="number" min="0" step="1" style={S.input} />
            <span style={S.hint}>El saldo pasa a disponible al confirmar el comprador o tras estos días desde la entrega.</span>
          </div>

          {/* Kill-switch de dinero real */}
          <div style={{ ...S.field, gap: 10 }}>
            <label style={S.label}>Checkout en vivo (dinero real)</label>
            <button type="button" onClick={() => setLive((v) => !v)} style={{ ...S.toggle, ...(live ? S.toggleOn : S.toggleOff) }}>
              <span style={{ ...S.knob, transform: live ? 'translateX(22px)' : 'translateX(0)' }} />
              <span style={S.toggleText}>{live ? 'EN VIVO' : 'APAGADO (sandbox)'}</span>
            </button>
            <div style={S.warn}>
              <Icon name="warning" size={16} style={{ color: '#EF9F27', flexShrink: 0, marginTop: 1 }} />
              <span><b>Cobro real.</b> Encender esto activa el dinero real cuando el checkout esté construido. No lo enciendas hasta la validación de contador/abogado.</span>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      )}
    </section>
  )
}

const S = {
  secTitle: { fontSize: 18, fontWeight: 800, color: C.text, fontFamily: FONT.headline, margin: '0 0 16px' },
  error: { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 14 },
  ok: { background: 'rgba(104,219,174,0.1)', border: '1px solid rgba(104,219,174,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.primary, marginBottom: 14 },
  muted: { fontSize: 14, color: C.onSurfaceVariant },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: C.onSurfaceVariant, fontWeight: 600 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: C.text, outline: 'none', fontFamily: 'inherit', maxWidth: 160 },
  hint: { fontSize: 11.5, color: C.textFaint, lineHeight: 1.5 },
  toggle: { display: 'inline-flex', alignItems: 'center', gap: 12, alignSelf: 'flex-start', border: 'none', borderRadius: 99, padding: '6px 14px 6px 6px', cursor: 'pointer', fontFamily: FONT.body },
  toggleOff: { background: 'rgba(255,255,255,0.06)' },
  toggleOn: { background: 'rgba(239,159,39,0.18)', border: '1px solid rgba(239,159,39,0.4)' },
  knob: { width: 22, height: 22, borderRadius: 99, background: '#fff', display: 'inline-block', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' },
  toggleText: { fontSize: 12, fontWeight: 800, color: C.onSurface, letterSpacing: 0.5 },
  warn: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: C.onSurface, background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.22)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 },
  saveBtn: { alignSelf: 'flex-start', background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: FONT.body },
}
