import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eegijaponqbxjqamcpah.supabase.co'
const supabaseKey = 'sb_publishable_xEE0Uw85M5jemC8GZ8cQZA_8DrIl52Z'
export const supabase = createClient(supabaseUrl, supabaseKey)