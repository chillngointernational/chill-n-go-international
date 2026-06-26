import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Libreta de direcciones de ENTREGA del comprador (tabla buyer_addresses, RLS owner-only).
// memberId = identity_profiles.id del usuario (owner_id). Devuelve { addresses, loading, reload }.
export function useBuyerAddresses(memberId) {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!memberId) { setAddresses([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('buyer_addresses')
      .select('*')
      .eq('owner_id', memberId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    setAddresses(data || [])
    setLoading(false)
  }, [memberId])

  useEffect(() => { reload() }, [reload])

  return { addresses, loading, reload }
}
