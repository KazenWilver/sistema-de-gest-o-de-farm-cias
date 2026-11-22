import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase/client';
import type { MemberRole, Membership, Pharmacy } from '@/types/database';
import { useAuth } from '@/features/auth/AuthProvider';

export const PRIVACY_NOTICE_VERSION = '1.0';
const STORAGE_KEY = 'farmastock.pharmacy';

interface PharmacyContextValue {
  pharmacy: Pharmacy;
  pharmacyId: string;
  role: MemberRole;
  memberships: Membership[];
  selectPharmacy: (id: string) => void;
  userId: string;
  displayName: string | null;
}

const PharmacyContext = createContext<PharmacyContextValue | null>(null);

function readStoredPharmacy(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useMemberships() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['memberships', userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('pharmacy_members')
          .select('id, pharmacy_id, user_id, role, is_active, pharmacies(*)')
          .eq('user_id', userId!)
          .eq('is_active', true),
      ) as unknown as Membership[],
  });
}

export function useOwnProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(
        await supabase.from('user_profiles').select('id, display_name').eq('id', userId!).maybeSingle(),
      ) as {
        id: string;
        display_name: string | null;
      } | null,
  });
}

export function usePrivacyAcknowledgement() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['privacy-ack', userId, PRIVACY_NOTICE_VERSION],
    enabled: !!userId,
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from('privacy_acknowledgements')
          .select('id, acknowledged_at')
          .eq('user_id', userId!)
          .eq('notice_version', PRIVACY_NOTICE_VERSION),
      ) as { id: string; acknowledged_at: string }[];
      return rows[0] ?? null;
    },
  });
}

export function PharmacyProvider({
  memberships,
  userId,
  displayName,
  children,
}: {
  memberships: Membership[];
  userId: string;
  displayName: string | null;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(readStoredPharmacy);
  const current = memberships.find((m) => m.pharmacy_id === selected) ?? memberships[0]!;

  const value = useMemo<PharmacyContextValue>(
    () => ({
      pharmacy: current.pharmacies,
      pharmacyId: current.pharmacy_id,
      role: current.role,
      memberships,
      userId,
      displayName,
      selectPharmacy: (id: string) => {
        setSelected(id);
        try {
          localStorage.setItem(STORAGE_KEY, id); // só o identificador, nunca dados de inventário
        } catch {
          /* armazenamento indisponível */
        }
      },
    }),
    [current, memberships, userId, displayName],
  );

  return <PharmacyContext value={value}>{children}</PharmacyContext>;
}

export function usePharmacy(): PharmacyContextValue {
  const ctx = use(PharmacyContext);
  if (!ctx) throw new Error('usePharmacy fora do PharmacyProvider');
  return ctx;
}
