import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { C, FONT, GRADIENT, Icon } from '../../stitch'

// Sección "Tiendas por aprobar" del panel /admin.
// LECTURA: el admin lee tiendas pending + su dueño por RLS (stores_select_own y
//   profiles_select_self ya incluyen `OR cng_has_role('admin')`). Sin RPC extra.
// DECISIÓN: SIEMPRE vía la edge function cng-admin-store-decision (la única puerta:
//   gate de admin server-side + RPC atómico). El cliente NUNCA muta stores.status.
// Aprobar -> {decision:'approve'}. Rechazar -> abre motivo OBLIGATORIO -> {decision:'reject', reason}.
// Tras cualquier decisión, refresca la lista.

export default function PendingStores() {
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)        // tienda en proceso (botones bloqueados)
  const [rejectingId, setRejectingId] = useState(null) // tienda con el campo de motivo abierto
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: e } = await supabase
      .from('stores')
      .select('id, name, slug, description, logo_url, created_at, owner:identity_profiles!stores_owner_id_fkey(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (e) {
      setError('No se pudo cargar la lista de tiendas.')
      setStores([])
    } else {
      setStores(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(storeId, decision, reasonText) {
    setBusyId(storeId)
    setError('')
    try {
      const body = { store_id: storeId, decision }
      if (decision === 'reject') body.reason = reasonText
      const { data, error: fnErr } = await supabase.functions.invoke('cng-admin-store-decision', { body })
      if (fnErr) {
        let msg = 'No se pudo procesar la decisión. Intenta de nuevo.'
        try { const b = await fnErr.context?.json?.(); if (b?.error) msg = b.error } catch { /* sin cuerpo */ }
        setError(msg)
        return
      }
      if (data?.error) { setError(data.error); return }
      // Éxito (aprobó, rechazó o no-op idempotente) -> limpiar y refrescar.
      setRejectingId(null)
      setReason('')
      await load()
    } catch (e2) {
      setError(e2?.message || 'No se pudo procesar la decisión.')
    } finally {
      setBusyId(null)
    }
  }

  function startReject(id) { setRejectingId(id); setReason(''); setError('') }
  function cancelReject() { setRejectingId(null); setReason('') }
  function confirmReject(id) {
    if (reason.trim().length === 0) { setError('El motivo de rechazo es obligatorio.'); return }
    decide(id, 'reject', reason.trim())
  }

  return (
    <section>
      <div style={S.secHead}>
        <h2 style={S.secTitle}>Tiendas por aprobar</h2>
        {!loading && <span style={S.count}>{stores.length}</span>}
      </div>

      {error && <div style={S.error}>{error}</div>}

      {loading ? (
        <p style={S.muted}>Cargando…</p>
      ) : stores.length === 0 ? (
        <div style={S.empty}>
          <Icon name="task_alt" size={28} style={{ color: C.primary }} />
          <p style={S.mutedCenter}>No hay tiendas pendientes de aprobación.</p>
        </div>
      ) : (
        <div style={S.list}>
          {stores.map((st) => {
            const busy = busyId === st.id
            const rejecting = rejectingId === st.id
            const owner = st.owner?.full_name || st.owner?.email || 'Dueño desconocido'
            const created = st.created_at ? new Date(st.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
            return (
              <div key={st.id} style={S.card}>
                <div style={S.cardTop}>
                  <div style={S.logo}>
                    {st.logo_url
                      ? <img src={st.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Icon name="storefront" size={22} style={{ color: C.onSurfaceVariant }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={S.name}>{st.name}</h3>
                    <div style={S.slug}>/tienda/{st.slug}</div>
                    <div style={S.owner}>
                      <Icon name="person" size={13} style={{ color: C.textFaint }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner}</span>
                      {created && <><span style={S.dot} /><span>{created}</span></>}
                    </div>
                  </div>
                </div>

                {st.description && <p style={S.desc}>{st.description}</p>}

                {!rejecting ? (
                  <div style={S.actions}>
                    <button onClick={() => decide(st.id, 'approve')} disabled={busy} style={{ ...S.approve, opacity: busy ? 0.5 : 1 }}>
                      {busy ? 'Procesando…' : 'Aprobar'}
                    </button>
                    <button onClick={() => startReject(st.id)} disabled={busy} style={{ ...S.reject, opacity: busy ? 0.5 : 1 }}>
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <div style={S.rejectBox}>
                    <label style={S.label}>Motivo del rechazo (obligatorio)</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      maxLength={500}
                      autoFocus
                      placeholder="Explica por qué se rechaza. El dueño verá este motivo."
                      style={S.textarea}
                    />
                    <div style={S.actions}>
                      <button onClick={() => confirmReject(st.id)} disabled={busy || reason.trim().length === 0} style={{ ...S.reject, opacity: (busy || reason.trim().length === 0) ? 0.5 : 1 }}>
                        {busy ? 'Procesando…' : 'Confirmar rechazo'}
                      </button>
                      <button onClick={cancelReject} disabled={busy} style={S.cancel}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const S = {
  secHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  secTitle: { fontSize: 18, fontWeight: 800, color: C.text, fontFamily: FONT.headline, margin: 0 },
  count: { fontSize: 12, fontWeight: 700, color: C.primary, background: 'rgba(104,219,174,0.12)', border: '1px solid rgba(104,219,174,0.25)', borderRadius: 99, padding: '2px 10px', minWidth: 22, textAlign: 'center' },
  error: { background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.error, marginBottom: 16 },
  muted: { fontSize: 14, color: C.onSurfaceVariant },
  mutedCenter: { fontSize: 14, color: C.onSurfaceVariant, margin: 0 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18 },
  cardTop: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  logo: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontSize: 16, fontWeight: 700, color: C.text, margin: 0, fontFamily: FONT.headline, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  slug: { fontSize: 12.5, color: C.primary, marginTop: 2 },
  owner: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textFaint, marginTop: 6 },
  dot: { width: 3, height: 3, borderRadius: 99, background: C.outlineVariant, display: 'inline-block', flexShrink: 0 },
  desc: { fontSize: 13.5, color: C.onSurface, lineHeight: 1.5, margin: '14px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  actions: { display: 'flex', gap: 10, marginTop: 16 },
  approve: { flex: 1, background: GRADIENT.primary, border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: FONT.body },
  reject: { flex: 1, background: 'transparent', border: '1px solid rgba(226,75,74,0.5)', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, color: C.errorBright, cursor: 'pointer', fontFamily: FONT.body },
  cancel: { flex: 1, background: 'transparent', border: '1px solid ' + C.outlineVariant, borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 600, color: C.onSurface, cursor: 'pointer', fontFamily: FONT.body },
  rejectBox: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 12.5, color: C.onSurfaceVariant, fontWeight: 600 },
  textarea: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, color: C.text, outline: 'none', fontFamily: 'inherit', resize: 'vertical' },
}
