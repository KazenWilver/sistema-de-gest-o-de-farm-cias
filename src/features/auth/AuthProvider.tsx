import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** Verdadeiro quando o utilizador chegou por convite ou recuperação e tem de definir a palavra-passe. */
  passwordSetupPending: boolean;
  clearPasswordSetup: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [passwordSetupPending, setPasswordSetupPending] = useState(() =>
    /type=(invite|recovery)/.test(window.location.hash),
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordSetupPending(true);
      if (event === 'SIGNED_OUT') queryClient.clear(); // nada do inventário fica em memória após sair
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      passwordSetupPending,
      clearPasswordSetup: () => setPasswordSetupPending(false),
      signOut: async () => {
        await supabase.auth.signOut({ scope: 'local' });
        queryClient.clear();
        try {
          localStorage.removeItem('farmastock.pharmacy');
        } catch {
          /* armazenamento indisponível */
        }
      },
    }),
    [session, loading, passwordSetupPending, queryClient],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
