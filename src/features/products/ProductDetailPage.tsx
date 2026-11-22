import { useState } from 'react';
import { useParams } from 'react-router';
import {
  Badge,
  ButtonLink,
  Card,
  DefinitionList,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Tabs,
} from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import {
  useAuditLogs,
  useBatches,
  useMovements,
  useProduct,
  useProductStockOne,
} from '@/features/inventory/api';
import { StockStateBadge } from '@/features/inventory/badges';
import { BatchTable } from '@/features/batches/BatchTable';
import { MovementTable } from '@/features/movements/MovementTable';
import { can } from '@/lib/permissions';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatQuantity } from '@/lib/stock';
import { toUserMessage } from '@/lib/errors';
import { describeAudit } from '@/features/settings/audit';

type Tab = 'info' | 'batches' | 'movements' | 'history';

export function ProductDetailPage() {
  const { id } = useParams();
  const { role } = usePharmacy();
  const [tab, setTab] = useState<Tab>('info');
  const product = useProduct(id);
  const stock = useProductStockOne(id);

  if (product.isPending) return <LoadingState />;
  if (product.isError)
    return <ErrorState message={toUserMessage(product.error)} onRetry={() => void product.refetch()} />;
  if (!product.data) return <EmptyState title="Produto não encontrado" />;
  const p = product.data;
  const s = stock.data;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Informação geral' },
    { id: 'batches', label: 'Lotes' },
    { id: 'movements', label: 'Movimentos' },
    ...(can(role, 'audit.read') ? [{ id: 'history' as const, label: 'Histórico de alterações' }] : []),
  ];

  return (
    <>
      <PageHeader
        title={`${p.name}${p.strength ? ` ${p.strength}` : ''}`}
        description={
          [p.active_ingredient, p.dosage_form, p.presentation].filter(Boolean).join(' · ') || undefined
        }
        actions={
          <>
            {can(role, 'stock.move') && p.is_active && (
              <>
                <ButtonLink to={`/movimentos/entrada?produto=${p.id}`}>Registar entrada</ButtonLink>
                <ButtonLink to={`/movimentos/saida?produto=${p.id}`} variant="secondary">
                  Registar saída
                </ButtonLink>
              </>
            )}
            {can(role, 'catalog.manage') && (
              <ButtonLink to={`/produtos/${p.id}/editar`} variant="secondary">
                Editar
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        {s && <StockStateBadge state={s.stock_state} />}
        {!p.is_active && <Badge>Inactivo</Badge>}
        {s && (
          <span className="text-ink-soft">
            Disponível:{' '}
            <strong className="tabular">{formatQuantity(s.available_quantity, p.unit_name)}</strong>
            {Number(s.unusable_quantity) > 0 && (
              <span className="text-danger-700">
                {' '}
                · {formatQuantity(s.unusable_quantity)} expirado/bloqueado
              </span>
            )}
            {' · '}Mínimo: {formatQuantity(p.minimum_stock)} · Próxima validade:{' '}
            {formatDate(s.next_expiry_date)}
          </span>
        )}
      </div>

      <Card>
        <div className="px-4 pt-2 sm:px-5">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
        </div>
        {tab === 'info' && (
          <div className="px-4 py-5 sm:px-5">
            <DefinitionList
              items={[
                ['Nome comercial', p.name],
                ['Princípio activo', p.active_ingredient ?? '—'],
                ['Marca / laboratório', p.brand ?? '—'],
                ['Dosagem', p.strength ?? '—'],
                ['Forma farmacêutica', p.dosage_form ?? '—'],
                ['Apresentação', p.presentation ?? '—'],
                ['Unidade de controlo', p.unit_name],
                ['Código interno', p.internal_code ?? '—'],
                ['Código de barras', p.barcode ?? '—'],
                ['Categoria', p.category ?? '—'],
                ['Stock mínimo', formatQuantity(p.minimum_stock, p.unit_name)],
                ['Observações internas', p.notes ?? '—'],
                ['Registado em', formatDateTime(p.created_at)],
                ['Última alteração', formatDateTime(p.updated_at)],
              ]}
            />
          </div>
        )}
        {tab === 'batches' && <ProductBatches productId={p.id} />}
        {tab === 'movements' && <ProductMovements productId={p.id} />}
        {tab === 'history' && <ProductHistory productId={p.id} />}
      </Card>
    </>
  );
}

function ProductBatches({ productId }: { productId: string }) {
  const batches = useBatches({ productId });
  if (batches.isPending) return <LoadingState />;
  if (batches.isError) return <ErrorState message={toUserMessage(batches.error)} />;
  if (!batches.data.length)
    return <EmptyState title="Sem lotes">Os lotes são criados ao registar entradas.</EmptyState>;
  return <BatchTable batches={batches.data} showProduct={false} />;
}

function ProductMovements({ productId }: { productId: string }) {
  const movements = useMovements({ productId, limit: 300 });
  if (movements.isPending) return <LoadingState />;
  if (movements.isError) return <ErrorState message={toUserMessage(movements.error)} />;
  if (!movements.data.length) return <EmptyState title="Sem movimentos" />;
  return <MovementTable movements={movements.data} showProduct={false} />;
}

function ProductHistory({ productId }: { productId: string }) {
  const logs = useAuditLogs(productId);
  if (logs.isPending) return <LoadingState />;
  if (logs.isError) return <ErrorState message={toUserMessage(logs.error)} />;
  if (!logs.data.length) return <EmptyState title="Sem alterações registadas" />;
  return (
    <DataTable
      rows={logs.data}
      rowKey={(l) => l.id}
      columns={[
        {
          header: 'Data e hora',
          cell: (l) => <span className="tabular">{formatDateTime(l.created_at)}</span>,
        },
        { header: 'Alteração', cell: (l) => describeAudit(l) },
      ]}
    />
  );
}
