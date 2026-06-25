import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// usePlatformConfig — lee la config de plataforma (singleton, lectura pública por RLS) UNA vez.
// Se usa sobre todo para commission_pct -> precio final que ve el cliente (clientPrice()).
// Devuelve el objeto de config, o null mientras carga.
export function usePlatformConfig() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    let alive = true
    supabase
      .from('platform_config')
      .select('commission_pct, cushion_pct, hold_days, checkout_live')
      .eq('id', true)
      .maybeSingle()
      .then(({ data }) => { if (alive) setConfig(data || null) })
    return () => { alive = false }
  }, [])
  return config
}
