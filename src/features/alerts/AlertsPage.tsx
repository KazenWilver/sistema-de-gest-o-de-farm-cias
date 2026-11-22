import { Link } from 'react-router';
import { Card, CardHeader, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { useBatches, useProductStock } from '@/features/inventory/api';
import {
  BatchStatusBadge,
  ExpiryBadge,
  StockStateBadge,
  useExpiryContext,
} from '@/features/inventory/badges';
import { BatchTable } from '@/features/batches/BatchTable';
import { formatDate } from '@/lib/dates';
import { expiryInfo, formatQuantity } from '@/lib/stock';
import { toUserMessage } from '@/lib/errors';

export function AlertsPage() {
  const { today, windows } = useExpiryContext();
  const products = useProductStock();
  const batches = useBatches({ withStockOnly: true });

  if (products.isPending || batches.isPending) return <LoadingState />;
  if (products.isError)
    return <ErrorState message={toUserMessage(products.error)} onRetry={() => void products.refetch()} />;
  if (batches.isError)
    return <ErrorState message={toUserMessage(batches.error)} onRetry={() => void batches.refetch()} />;

  const stockAlerts = products.data
    .filter((p) => p.is_active && p.stock_state !== 'ok')
    .sort((a, b) =>
      a.stock_state === b.stock_state ? a.name.localeCompare(b.name) : a.stock_state === 'out' ? -1 : 1,
    );
  const sortedWindows = [...windows].sort((a, b) => a - b);
  const expiring = batches.data.filter(
    (b) => b.effective_status === 'active' && expiryInfo(b.expiry_date, today, windows).state === 'soon',
  );
  const unusable = batches.data.filter(
    (b) => b.effective_status === 'expired' || b.effective_status === 'blocked',
  );

  return (
    <>
      <PageHeader
        title="Alertas"
        description={`Janelas de validade configuradas: ${sortedWindows.join(', ')} dias. O sistema avisa; a decisão sobre a dispensa é sempre do farmacêutico responsável.`}
      />
      <div className="space-y-5">
        <Card>
          <CardHeader title="Stock baixo e esgotado" description={`${stockAlerts.length} produtos activos`} />
          {stockAlerts.length ? (
            <DataTable
              rows={stockAlerts}
              rowKey={(p) => p.id}
              columns={[
                {
                  header: 'Produto',
                  cell: (p) => (
                    <Link to={`/produtos/${p.id}`} className="font-medium hover:underline">
                      {p.name} {p.strength && <span className="font-normal text-muted">{p.strength}</span>}
                    </Link>
                  ),
                },
                {
                  header: 'Disponível',
                  align: 'right',
                  cell: (p) => formatQuantity(p.available_quantity, p.unit_name),
                },
                { header: 'Mínimo', align: 'right', cell: (p) => formatQuantity(p.minimum_stock) },
                { header: 'Estado', cell: (p) => <StockStateBadge state={p.stock_state} /> },
              ]}
            />
          ) : (
            <EmptyState title="Sem alertas de stock" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Validade próxima"
            description="Lotes com stock dentro das janelas de alerta, do mais urgente para o menos urgente."
          />
          {expiring.length ? (
            <div className="divide-y divide-line">
              {sortedWindows.map((w, i) => {
                const lower = i === 0 ? -1 : sortedWindows[i - 1]!;
                const group = expiring.filter(
                  (b) => b.days_to_expiry !== null && b.days_to_expiry > lower && b.days_to_expiry <= w,
                );
                if (!group.length) return null;
                return (
                  <div key={w}>
                    <p className="bg-canvas/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted sm:px-5">
                      Até {w} dias ({group.length})
                    </p>
                    <BatchTable batches={group} />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Nenhum lote dentro das janelas de alerta" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Expirados ou bloqueados com quantidade"
            description="Não podem ser usados em saídas normais. Registe a eliminação ou a devolução."
          />
          {unusable.length ? (
            <DataTable
              rows={unusable}
              rowKey={(b) => b.id}
              columns={[
                {
                  header: 'Produto',
                  cell: (b) => (
                    <Link to={`/produtos/${b.product_id}`} className="font-medium hover:underline">
                      {b.product_name}
                    </Link>
                  ),
                },
                {
                  header: 'Lote',
                  cell: (b) => <span className="font-mono text-[13px]">{b.lot_number}</span>,
                },
                {
                  header: 'Validade',
                  cell: (b) => (
                    <span className="flex flex-wrap items-center gap-2">
                      {formatDate(b.expiry_date)} <ExpiryBadge date={b.expiry_date} />
                    </span>
                  ),
                },
                {
                  header: 'Quantidade',
                  align: 'right',
                  cell: (b) => formatQuantity(b.available_quantity, b.unit_name),
                },
                { header: 'Estado', cell: (b) => <BatchStatusBadge status={b.effective_status} /> },
                {
                  header: 'Acção',
                  cell: (b) => (
                    <Link
                      to={`/movimentos/saida?produto=${b.product_id}&lote=${b.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      Registar eliminação/devolução
                    </Link>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState title="Sem lotes expirados ou bloqueados com quantidade" />
          )}
        </Card>
      </div>
    </>
  );
}
