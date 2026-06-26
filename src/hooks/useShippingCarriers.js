import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Lee las paqueterías curadas (tabla shipping_carriers, lectura pública por RLS).
// Por defecto trae TODAS (para el panel admin); pasa { enabledOnly:true } para el cotizador.
// Devuelve { carriers, loading, reload }.
export function useShippingCarriers({ enabledOnly = false } = {}) {
  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('shipping_carriers')
      .select('code, label, enabled, sort_order')
      .order('sort_order', { ascending: true })
    if (enabledOnly) q = q.eq('enabled', true)
    const { data } = await q
    setCarriers(data || [])
    setLoading(false)
  }, [enabledOnly])

  useEffect(() => { reload() }, [reload])

  return { carriers, loading, reload }
}
