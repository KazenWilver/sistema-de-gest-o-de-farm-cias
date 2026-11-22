import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Falso enquanto o .env.local não estiver preenchido; a aplicação mostra instruções em vez de falhar. */
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT'));

// Só a chave pública (anon/publishable). A service_role NUNCA pode estar no frontend.
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? url! : 'http://localhost:54321',
  isSupabaseConfigured ? anonKey! : 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  },
);

/** Lança o erro do Supabase para o TanStack Query o tratar. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}
