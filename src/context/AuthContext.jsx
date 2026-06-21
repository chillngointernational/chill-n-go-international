import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchMember(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchMember(session.user.id)
      else {
        setMember(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchMember(userId, attempt = 0) {
    try {
      const { data, error } = await supabase
        .from('identity_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error

      // Éxito: data = perfil del usuario, o null si la fila no existe (sin perfil).
      // "Sin perfil" se trata como no-activo; el muro de activación lo atrapa.
      setMember(data ?? null)
      setLoading(false)
    } catch (e) {
      // Error transitorio (red/servidor): reintenta hasta 2 veces con backoff y
      // NO degrada a null un member ya cargado (no atrapar a un activo por un
      // fallo de red puntual). Se hace AWAIT del reintento para que quien llame
      // `await fetchMember()` (ActivateScreen/SubscriptionScreen/ProfileScreen)
      // no resuelva antes de que el reintento termine. Si persiste, deja el
      // member como estaba.
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        return fetchMember(userId, attempt + 1)
      }
      console.error('Error fetching member (tras reintentos):', e)
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, refCode) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { ref_code: refCode },
        emailRedirectTo: window.location.origin + '/verify-success'
      }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setMember(null)
  }

  return (
    <AuthContext.Provider value={{ user, member, loading, signIn, signUp, signOut, fetchMember }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}