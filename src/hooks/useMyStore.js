import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// useMyStore — lee la tienda PROPIA del usuario logueado (owner_id = member.id) para
// decidir navegación de vendedor (rótulos/accesos a /mi-tienda). Devuelve { store, loading }.
//
// SOLO navegación: no toca seguridad/RLS/DB. La lectura la permite la RLS existente
// stores_select_own (cng_owns_store), que es INDEPENDIENTE de la membresía -> funciona para
// vendedores NO-miembros (leen su tienda esté pending/active/rejected).
//
// Para ANÓNIMOS (sin user/member) la consulta NO se dispara (early return) -> cero impacto
// al público de marketing.
export function useMyStore() {
  const { user, member } = useAuth()
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    if (!user || !member?.id) { setStore(null); setLoading(false); return }
    setLoading(true)
    supabase
      .from('stores')
      .select('id, slug, status')
      .eq('owner_id', member.id)
      .maybeSingle()
      .then(({ data }) => { if (alive) { setStore(data || null); setLoading(false) } })
    return () => { alive = false }
  }, [user, member?.id])

  return { store, loading }
}
