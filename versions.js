   import { supabase } from './supabaseClient.js'

   export async function saveVersion(documentId, content, userId) {
     const { data, error } = await supabase
       .from('versions')
       .insert([{ document_id: documentId, content, user_id: userId }])
     return { data, error }
   }