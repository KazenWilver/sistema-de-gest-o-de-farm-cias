import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase/client';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import type {
  AuditLog,
  BackupRun,
  BatchOverview,
  MovementOverview,
  MovementSummaryRow,
  MovementType,
  Product,
  ProductStock,
  StockCount,
  StockCountItem,
  Supplier,
  TeamMember,
} from '@/types/database';

const PAGE = 1000; // limite max_rows da API

/** Lê todas as páginas (a API devolve no máximo 1000 linhas por pedido). */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = unwrap(await build(from, from + PAGE - 1));
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** Chave raiz por farmácia: qualquer operação de stock invalida tudo o que é desta farmácia. */
export function usePharmacyKey() {
  const { pharmacyId } = usePharmacy();
  return (...parts: unknown[]) => ['ph', pharmacyId, ...parts];
}

export function useInvalidatePharmacy() {
  const queryClient = useQueryClient();
  const { pharmacyId } = usePharmacy();
  return () => queryClient.invalidateQueries({ queryKey: ['ph', pharmacyId] });
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export function useProductStock() {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('product_stock'),
    queryFn: () =>
      fetchAll<ProductStock>((from, to) =>
        supabase
          .from('product_stock')
          .select('*')
          .eq('pharmacy_id', pharmacyId)
          .order('name')
          .range(from, to),
      ),
  });
}

export function useProduct(id: string | undefined) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('product', id),
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase.from('products').select('*').eq('pharmacy_id', pharmacyId).eq('id', id!).maybeSingle(),
      ) as Product | null,
  });
}

export function useProductStockOne(id: string | undefined) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('product_stock', id),
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('product_stock')
          .select('*')
          .eq('pharmacy_id', pharmacyId)
          .eq('id', id!)
          .maybeSingle(),
      ) as ProductStock | null,
  });
}

export function useBatches(options: { productId?: string; withStockOnly?: boolean } = {}) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('batches', options),
    queryFn: () =>
      fetchAll<BatchOverview>((from, to) => {
        let q = supabase.from('batch_overview').select('*').eq('pharmacy_id', pharmacyId);
        if (options.productId) q = q.eq('product_id', options.productId);
        if (options.withStockOnly) q = q.gt('available_quantity', 0);
        return q.order('expiry_date', { ascending: true, nullsFirst: false }).range(from, to);
      }),
  });
}

export interface MovementFilters {
  productId?: string;
  batchId?: string;
  type?: MovementType | '';
  from?: string; // YYYY-MM-DD (dia em Luanda)
  to?: string;
  limit?: number;
}

/** Converte um dia em Luanda (UTC+1, sem horário de Verão) para o instante UTC de início. */
export function luandaDayStartUtc(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00+01:00`).toISOString();
}

export function useMovements(filters: MovementFilters = {}) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('movements', filters),
    queryFn: async () => {
      let q = supabase.from('movement_overview').select('*').eq('pharmacy_id', pharmacyId);
      if (filters.productId) q = q.eq('product_id', filters.productId);
      if (filters.batchId) q = q.eq('batch_id', filters.batchId);
      if (filters.type) q = q.eq('movement_type', filters.type);
      if (filters.from) q = q.gte('created_at', luandaDayStartUtc(filters.from));
      if (filters.to) {
        const next = new Date(luandaDayStartUtc(filters.to));
        next.setUTCDate(next.getUTCDate() + 1);
        q = q.lt('created_at', next.toISOString());
      }
      return unwrap(
        await q.order('created_at', { ascending: false }).limit(filters.limit ?? 200),
      ) as MovementOverview[];
    },
  });
}

export function useAllMovementsForExport() {
  const { pharmacyId } = usePharmacy();
  return async (from: string, to: string) => {
    const next = new Date(luandaDayStartUtc(to));
    next.setUTCDate(next.getUTCDate() + 1);
    return fetchAll<MovementOverview>((a, b) =>
      supabase
        .from('movement_overview')
        .select('*')
        .eq('pharmacy_id', pharmacyId)
        .gte('created_at', luandaDayStartUtc(from))
        .lt('created_at', next.toISOString())
        .order('created_at', { ascending: true })
        .range(a, b),
    );
  };
}

export function useMovementSummary(from: string, to: string) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('movement_summary', from, to),
    queryFn: async () =>
      unwrap(
        await supabase.rpc('movement_summary', { p_pharmacy_id: pharmacyId, p_from: from, p_to: to }),
      ) as MovementSummaryRow[],
  });
}

export function useSuppliers(includeInactive = true) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('suppliers', includeInactive),
    queryFn: async () => {
      let q = supabase.from('suppliers').select('*').eq('pharmacy_id', pharmacyId);
      if (!includeInactive) q = q.eq('is_active', true);
      return unwrap(await q.order('name')) as Supplier[];
    },
  });
}

export function useAuditLogs(entityId?: string, limit = 100) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('audit', entityId, limit),
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('*, actor:user_profiles(display_name)')
        .eq('pharmacy_id', pharmacyId);
      if (entityId) q = q.eq('entity_id', entityId);
      return unwrap(await q.order('created_at', { ascending: false }).limit(limit)) as AuditLog[];
    },
  });
}

export function useStockCounts() {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('stock_counts'),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('stock_counts')
          .select('*')
          .eq('pharmacy_id', pharmacyId)
          .order('started_at', { ascending: false })
          .limit(50),
      ) as StockCount[],
  });
}

export function useStockCount(id: string | undefined) {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('stock_count', id),
    enabled: !!id,
    queryFn: async () => {
      const count = unwrap(
        await supabase
          .from('stock_counts')
          .select('*')
          .eq('pharmacy_id', pharmacyId)
          .eq('id', id!)
          .maybeSingle(),
      ) as StockCount | null;
      const items = await fetchAll<StockCountItem>((from, to) =>
        supabase.from('stock_count_items').select('*').eq('stock_count_id', id!).order('id').range(from, to),
      );
      return { count, items };
    },
  });
}

export function useMembers() {
  const { pharmacyId } = usePharmacy();
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('members'),
    queryFn: async () =>
      unwrap(await supabase.rpc('list_members', { p_pharmacy_id: pharmacyId })) as TeamMember[],
  });
}

export function useBackupRuns() {
  const key = usePharmacyKey();
  return useQuery({
    queryKey: key('backup_runs'),
    queryFn: async () =>
      unwrap(
        await supabase.from('backup_runs').select('*').order('started_at', { ascending: false }).limit(30),
      ) as BackupRun[],
  });
}

// ---------------------------------------------------------------------------
// Operações (RPC): o servidor valida tudo; o cliente só envia o pedido.
// ---------------------------------------------------------------------------
function useRpc<TArgs extends Record<string, unknown>>(fn: string) {
  const { pharmacyId } = usePharmacy();
  const invalidate = useInvalidatePharmacy();
  return useMutation({
    mutationFn: async (args: TArgs) =>
      unwrap(await supabase.rpc(fn, { p_pharmacy_id: pharmacyId, ...args })) as Record<string, unknown>,
    onSuccess: () => invalidate(),
  });
}

export const useReceiveStock = () =>
  useRpc<{
    p_product_id: string;
    p_lot_number: string;
    p_expiry_date: string | null;
    p_quantity: number;
    p_idempotency_key: string;
    p_supplier_id: string | null;
    p_purchase_unit_cost: number | null;
    p_reference_sale_price: number | null;
    p_reference: string | null;
  }>('receive_stock');

export const useIssueStock = () =>
  useRpc<{
    p_batch_id: string;
    p_quantity: number;
    p_movement_type: MovementType;
    p_idempotency_key: string;
    p_reason: string | null;
    p_reference: string | null;
  }>('issue_stock');

export const useAdjustStock = () =>
  useRpc<{ p_batch_id: string; p_new_quantity: number; p_reason: string; p_idempotency_key: string }>(
    'adjust_stock',
  );

export const useReverseMovement = () =>
  useRpc<{ p_movement_id: string; p_reason: string; p_idempotency_key: string }>('reverse_movement');

export const useSetBatchStatus = () =>
  useRpc<{ p_batch_id: string; p_status: 'active' | 'blocked'; p_reason: string }>('set_batch_status');

export const useStartStockCount = () => useRpc<{ p_notes: string | null }>('start_stock_count');
export const useRecordCountItem = () =>
  useRpc<{ p_item_id: string; p_counted_quantity: number | null }>('record_count_item');
export const useSubmitStockCount = () => useRpc<{ p_count_id: string }>('submit_stock_count');
export const useApproveStockCount = () => useRpc<{ p_count_id: string }>('approve_stock_count');
export const useCancelStockCount = () => useRpc<{ p_count_id: string }>('cancel_stock_count');

export const useUpdateMemberRole = () =>
  useRpc<{ p_member_id: string; p_role: string; p_is_active: boolean | null }>('update_member');

/** Chamada à Edge Function team-admin (convites e activação de contas). */
export function useTeamAdmin() {
  const { pharmacyId } = usePharmacy();
  const invalidate = useInvalidatePharmacy();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('team-admin', {
        body: { pharmacyId, ...body },
      });
      if (error) {
        const context = (error as { context?: Response }).context;
        const detail = context
          ? ((await context.json().catch(() => null)) as { error?: string } | null)
          : null;
        throw { code: 'P0001', message: detail?.error ?? 'Não foi possível concluir a operação.' };
      }
      return data;
    },
    onSuccess: () => invalidate(),
  });
}
