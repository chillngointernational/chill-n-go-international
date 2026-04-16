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

  async function fetchMember(userId) {
    try {
      const { data, error } = await supabase
        .from('identity_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data) setMember(data)
    } catch (e) {
      console.error('Error fetching member:', e)
    } finally {
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