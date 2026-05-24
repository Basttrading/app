import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://okdwgpzzildcxupmyliq.supabase.co'
const supabaseKey = 'sb_publishable_BLxVVkqW_jD0BDfhSS-hdg_cvd7Fq_7'

export const supabase = createClient(supabaseUrl, supabaseKey)
