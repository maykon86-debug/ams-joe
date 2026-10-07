import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createSupabaseClient> | undefined

export function createClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error('Supabase client environment variables are missing')
    }

    client = createSupabaseClient(url, key)
  }

  return client
}
