import { Navigate, useLocation } from 'react-router';
import { LoadingState, ErrorState } from '@/components/ui';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/features/auth/AuthProvider';
import { NoAccessPage, NotConfiguredPage, PrivacyAcknowledgePage } from '@/features/auth/pages';
import {
  PharmacyProvider,
  useMemberships,
  useOwnProfile,
  usePrivacyAcknowledgement,
} from '@/features/pharmacy/PharmacyProvider';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { toUserMessage } from '@/lib/errors';

/** Sessão → pertença a uma farmácia activa → leitura do aviso de privacidade → aplicação. */
export function AppGate() {
  const { session, loading, passwordSetupPending } = useAuth();
  const location = useLocation();
  const memberships = useMemberships();
  const profile = useOwnProfile();
  const ack = usePrivacyAcknowledgement();

  if (!isSupabaseConfigured) return <NotConfiguredPage />;
  if (loading) return <FullPageLoading />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  if (passwordSetupPending) return <Navigate to="/definir-palavra-passe" replace />;

  if (memberships.isPending || ack.isPending || profile.isPending) return <FullPageLoading />;
  if (memberships.isError) {
    return (
      <ErrorState message={toUserMessage(memberships.error)} onRetry={() => void memberships.refetch()} />
    );
  }
  if (!memberships.data.length) return <NoAccessPage />;
  if (!ack.data) return <PrivacyAcknowledgePage userId={session.user.id} />;

  return (
    <PharmacyProvider
      memberships={memberships.data}
      userId={session.user.id}
      displayName={profile.data?.display_name ?? session.user.email ?? null}
    >
      <AppShell />
    </PharmacyProvider>
  );
}

function FullPageLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoadingState />
    </div>
  );
}
