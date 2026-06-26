import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../../stitch'
import { useShippingCarriers } from '../../hooks/useShippingCarriers'

// Sección "Paqueterías" del panel /admin (E-3). Curaduría de la lista de carriers que el cotizador
// (edge cng-shipping-quote) consulta. Lee shipping_carriers (lectura pública por RLS) y guarda vía
// rpc_admin_upsert_carrier (SECURITY DEFINER auto-gateado con cng_is_admin -> un no-admin no puede
// escribir). El edge hace fan-out SOLO a los carriers 'enabled', en orden por sort_order.

export default function ShippingCarriers() {
  const { carriers, loading, reload } = useShippingCarriers()
  const [busy, setBusy] = useState(null) // code en guardado
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  async function save(c, patch) {
    setError(''); setOkMsg(''); setBusy(c.code)
    try {
      const next = { p_code: c.code, p_label: c.label, p_enabled: c.enabled, p_sort_order: c.sort_order, ...patch }
      const { error: rpcErr } = await supabase.rpc('rpc_admin_upsert_carrier', next)
      if (rpcErr) { setError('No se pudo guardar la paquetería.'); return }
      setOkMsg('Guardado.')
      await reload()
    } finally { setBusy(null) }
  }

  const enabledCount = carriers.filter((c) => c.enabled).length

  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={S.secTitle}>Paqueterías</h2>
      <p style={S.intro}>
        El cotizador de envío pregunta precios SOLO a las paqueterías activas, en este orden.
        {' '}<b style={{ color: C.primary }}>{enabledCount}</b> activa{enabledCount === 1 ? '' : 's'}.
      </p>

      {error && <div style={S.error}>{error}</div>}
      {okMsg && <div style={S.ok}>{okMsg}</div>}

      {loading ? (
        <p style={S.muted}>Cargando…</p>
      ) : (
        <div style={S.card}>
          {carriers.map((c) => (
            <div key={c.code} style={S.row}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={S.label}>{c.label}</p>
                <p style={S.code}>{c.code} · orden {c.sort_order}</p>
              </div>
              <div style={S.actions}>
                <input
                  type="number" value={c.sort_order} disabled={busy === c.code} step="1"
                  onChange={(e) => save(c, { p_sort_order: Math.floor(Number(e.target.value)) || 0 })}
                  style={S.sortInput} title="Orden"
                />
                <button
                  type="button" disabled={busy === c.code}
                  onClick={() => save(c, { p_enabled: !c.enabled })}
                  style={{ ...S.toggle, ...(c.enabled ? S.toggleOn : S.toggleOff) }}
                >
                  <span style={{ ...S.knob, transform: c.enabled ? 'translateX(18px)' : 'translateX(0)' }} />
                  <span style={S.toggleText}>{c.enabled ? 'Activa' : 'Apagada'}</span>
                </button>
              </div>
            </div>
          ))}
          <p style={S.hint}>El precio mostrado al comprador es la tarifa de la paquetería (sin margen, por ahora).</p>
        </div>
      )}
    </section>
  )
}

const S = {
  secTitle: { fontSize: 18, fontWeight: 800, color: C.text, fontFamily: FONT.headline, margin: '0 0 8px' },
  intro: { fontSize: 13, color: C.onSurfaceVariant, margin: '0 0 16px', lineHeight: 1.5 },
  error: { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 14 },
  ok: { background: 'rgba(104,219,174,0.1)', border: '1px solid rgba(104,219,174,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.primary, marginBottom: 14 },
  muted: { fontSize: 14, color: C.onSurfaceVariant },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 8, display: 'flex', flexDirection: 'column' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  label: { fontSize: 14.5, fontWeight: 700, color: C.text, margin: 0, fontFamily: FONT.headline },
  code: { fontSize: 11.5, color: C.textFaint, margin: '2px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 10 },
  sortInput: { width: 56, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: C.text, outline: 'none', fontFamily: 'inherit', textAlign: 'center' },
  toggle: { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 99, padding: '5px 12px 5px 5px', cursor: 'pointer', fontFamily: FONT.body },
  toggleOff: { background: 'rgba(255,255,255,0.06)' },
  toggleOn: { background: 'rgba(104,219,174,0.16)', border: '1px solid rgba(104,219,174,0.4)' },
  knob: { width: 18, height: 18, borderRadius: 99, background: '#fff', display: 'inline-block', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' },
  toggleText: { fontSize: 11.5, fontWeight: 800, color: C.onSurface, letterSpacing: 0.3 },
  hint: { fontSize: 11.5, color: C.textFaint, lineHeight: 1.5, padding: '12px 12px 4px' },
}
