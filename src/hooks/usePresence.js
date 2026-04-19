import { useEffect, useRef } from 'react'
import { supabase, supabaseUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const HEARTBEAT_INTERVAL_MS = 30 * 1000

export function usePresence() {
  const { user } = useAuth()
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!user) return

    const updatePresence = async (isOnline) => {
      try {
        await supabase
          .from('user_presence')
          .upsert({
            user_id: user.id,
            last_seen_at: new Date().toISOString(),
            is_online: isOnline,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
      } catch (e) {
        console.error('Presence update error:', e)
      }
    }

    updatePresence(true)

    intervalRef.current = setInterval(() => {
      updatePresence(true)
    }, HEARTBEAT_INTERVAL_MS)

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        `${supabaseUrl}/rest/v1/user_presence?user_id=eq.${user.id}`,
        new Blob(
          [JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() })],
          { type: 'application/json' }
        )
      )
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updatePresence(false)
      } else if (document.visibilityState === 'visible') {
        updatePresence(true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalRef.current)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      updatePresence(false)
    }
  }, [user])
}
