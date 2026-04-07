import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jahnlhzbjcbmjnuzxsvj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaG5saHpiamNibWpudXp4c3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDQ0NTksImV4cCI6MjA4NzIyMDQ1OX0.KMuwdmjL4iTnFa_h9nVtfDrSFClVdcBhttXreEyq7aA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'cng-auth',
        flowType: 'pkce',
    },
})