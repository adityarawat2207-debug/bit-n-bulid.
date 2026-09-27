import { supabase } from './supabaseClient.js'

async function test() {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')

  console.log('data:', data)
  console.log('error:', error)
}

test()