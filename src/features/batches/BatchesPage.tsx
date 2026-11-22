import { useMemo, useState } from 'react';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { Input, Select } from '@/components/forms/Field';
import { useBatches } from '@/features/inventory/api';
import { useExpiryContext } from '@/features/inventory/badges';
import { toUserMessage } from '@/lib/errors';
import { BatchTable } from './BatchTable';

type Filter = 'available' | 'expiring' | 'expired' | 'blocked' | 'depleted' | 'all';

export function BatchesPage() {
  const { maxWindow } = useExpiryContext();
  const batches = useBatches();
  const [filter, setFilter] = useState<Filter>('available');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (batches.data ?? []).filter((b) => {
      if (q && !b.lot_number.toLowerCase().includes(q) && !b.product_name.toLowerCase().includes(q))
        return false;
      switch (filter) {
        case 'available':
          return b.effective_status === 'active';
        case 'expiring':
          return (
            b.effective_status === 'active' && b.days_to_expiry !== null && b.days_to_expiry <= maxWindow
          );
        case 'expired':
          return b.effective_status === 'expired' && b.available_quantity > 0;
        case 'blocked':
          return b.effective_status === 'blocked';
        case 'depleted':
          return b.effective_status === 'depleted';
        default:
          return true;
      }
    });
  }, [batches.data, filter, query, maxWindow]);

  return (
    <>
      <PageHeader
        title="Lotes e stock"
        description="Cada lote tem número, validade e quantidade. Lotes expirados ou bloqueados não podem ser usados em saídas normais."
      />
      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-[1fr_auto] sm:px-5">
          <Input
            type="search"
            aria-label="Pesquisar por produto ou número de lote"
            placeholder="Produto ou número de lote"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            aria-label="Filtrar lotes"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="available">Disponíveis</option>
            <option value="expiring">Validade nos próximos {maxWindow} dias</option>
            <option value="expired">Expirados com quantidade</option>
            <option value="blocked">Bloqueados / retirados</option>
            <option value="depleted">Esgotados</option>
            <option value="all">Todos</option>
          </Select>
        </div>
        {batches.isPending ? (
          <LoadingState />
        ) : batches.isError ? (
          <ErrorState message={toUserMessage(batches.error)} onRetry={() => void batches.refetch()} />
        ) : rows.length ? (
          <BatchTable batches={rows} />
        ) : (
          <EmptyState title="Nenhum lote nesta vista">
            Os lotes são criados automaticamente ao registar entradas.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
