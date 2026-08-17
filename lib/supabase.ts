import { createClient } from '@supabase/supabase-js'
export const SUPABASE_URL = 'https://ujpsoxgdsqkwcywyvnno.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_M-dLoOThrazh4uigeQkMgA_mLT8q3W5'
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})
