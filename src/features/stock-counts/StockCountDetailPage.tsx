import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
} from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Input } from '@/components/forms/Field';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import {
  useApproveStockCount,
  useBatches,
  useCancelStockCount,
  useRecordCountItem,
  useStockCount,
  useSubmitStockCount,
} from '@/features/inventory/api';
import { can } from '@/lib/permissions';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatQuantity } from '@/lib/stock';
import { toUserMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { StockCountItem } from '@/types/database';
import { COUNT_STATUS } from './StockCountsPage';

type Action = 'submit' | 'approve' | 'cancel' | null;

export function StockCountDetailPage() {
  const { id } = useParams();
  const { role } = usePharmacy();
  const { notify } = useToast();
  const online = useOnlineStatus();
  const data = useStockCount(id);
  const batches = useBatches();
  const record = useRecordCountItem();
  const submit = useSubmitStockCount();
  const approve = useApproveStockCount();
  const cancel = useCancelStockCount();
  const [action, setAction] = useState<Action>(null);
  const [filter, setFilter] = useState('');

  const batchById = useMemo(() => new Map((batches.data ?? []).map((b) => [b.id, b])), [batches.data]);

  if (data.isPending || batches.isPending) return <LoadingState />;
  if (data.isError)
    return <ErrorState message={toUserMessage(data.error)} onRetry={() => void data.refetch()} />;
  if (!data.data.count) return <EmptyState title="Contagem não encontrada" />;

  const { count, items } = data.data;
  const editable = count.status === 'in_progress' && can(role, 'stock.move');
  const counted = items.filter((i) => i.counted_quantity !== null);
  const withDiff = counted.filter((i) => Number(i.difference) !== 0);
  const q = filter.trim().toLowerCase();
  const rows = items.filter((i) => {
    if (!q) return true;
    const b = i.batch_id ? batchById.get(i.batch_id) : undefined;
    return (
      (b?.product_name ?? '').toLowerCase().includes(q) || (b?.lot_number ?? '').toLowerCase().includes(q)
    );
  });

  const run = () => {
    const mutation = action === 'submit' ? submit : action === 'approve' ? approve : cancel;
    mutation.mutate(
      { p_count_id: count.id },
      {
        onSuccess: () => {
          notify(
            action === 'approve'
              ? 'Contagem aprovada. Os ajustes foram aplicados.'
              : action === 'submit'
                ? 'Contagem enviada para aprovação.'
                : 'Contagem cancelada.',
          );
          setAction(null);
        },
      },
    );
  };
  const activeMutation = action === 'submit' ? submit : action === 'approve' ? approve : cancel;

  return (
    <>
      <PageHeader
        title={`Contagem de ${formatDate(count.started_at)}`}
        description={count.notes ?? undefined}
        actions={
          <>
            {count.status === 'in_progress' && can(role, 'stock.move') && (
              <Button onClick={() => setAction('submit')} disabled={!counted.length || !online}>
                Enviar para aprovação
              </Button>
            )}
            {count.status === 'review' && can(role, 'stock.adjust') && (
              <Button onClick={() => setAction('approve')} disabled={!online}>
                Aprovar e aplicar ajustes
              </Button>
            )}
            {['in_progress', 'review'].includes(count.status) && can(role, 'stock.move') && (
              <Button variant="secondary" onClick={() => setAction('cancel')} disabled={!online}>
                Cancelar contagem
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <Badge tone={COUNT_STATUS[count.status].tone}>{COUNT_STATUS[count.status].label}</Badge>
        <span>
          {counted.length} de {items.length} linhas contadas · {withDiff.length} com diferença
        </span>
        {count.completed_at && <span>· concluída em {formatDateTime(count.completed_at)}</span>}
      </div>
      {count.status === 'review' && !can(role, 'stock.adjust') && (
        <Notice tone="info" className="mb-4">
          A contagem aguarda aprovação do gestor ou da administradora.
        </Notice>
      )}
      {editable && (
        <Notice tone="info" className="mb-4">
          Escreva a quantidade observada em cada lote. Cada valor é guardado quando sai do campo. Linhas sem
          valor não geram ajustes.
        </Notice>
      )}

      <Card>
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <Input
            type="search"
            aria-label="Filtrar por produto ou lote"
            placeholder="Filtrar por produto ou lote"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {items.length ? (
          <DataTable
            rows={rows}
            rowKey={(i) => i.id}
            rowClassName={(i) =>
              i.counted_quantity !== null && Number(i.difference) !== 0 ? 'bg-warning-50/50' : undefined
            }
            columns={[
              {
                header: 'Produto / lote',
                cell: (i) => {
                  const b = i.batch_id ? batchById.get(i.batch_id) : undefined;
                  return (
                    <div>
                      <p className="font-medium">{b?.product_name ?? '—'}</p>
                      <p className="text-xs text-muted">
                        Lote {b?.lot_number ?? '—'} · validade {formatDate(b?.expiry_date ?? null)}
                      </p>
                    </div>
                  );
                },
              },
              {
                header: 'Sistema',
                align: 'right',
                cell: (i) =>
                  formatQuantity(
                    i.expected_quantity,
                    i.batch_id ? batchById.get(i.batch_id)?.unit_name : undefined,
                  ),
              },
              {
                header: 'Contado',
                align: 'right',
                cell: (i) =>
                  editable ? (
                    <CountInput
                      item={i}
                      onSave={(v) => record.mutate({ p_item_id: i.id, p_counted_quantity: v })}
                    />
                  ) : (
                    formatQuantity(i.counted_quantity)
                  ),
              },
              {
                header: 'Diferença',
                align: 'right',
                cell: (i) =>
                  i.counted_quantity === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span
                      className={Number(i.difference) === 0 ? 'text-muted' : 'font-semibold text-warning-700'}
                    >
                      {Number(i.difference) > 0 ? '+' : ''}
                      {formatQuantity(i.difference)}
                    </span>
                  ),
              },
            ]}
          />
        ) : (
          <EmptyState title="Não havia lotes com stock quando a contagem começou" />
        )}
      </Card>
      {record.isError && (
        <Notice tone="danger" className="mt-3">
          {toUserMessage(record.error)}
        </Notice>
      )}

      <ConfirmDialog
        open={!!action}
        title={
          action === 'approve'
            ? 'Aprovar contagem'
            : action === 'submit'
              ? 'Enviar para aprovação'
              : 'Cancelar contagem'
        }
        confirmLabel={
          action === 'approve' ? 'Aprovar e aplicar' : action === 'submit' ? 'Enviar' : 'Cancelar contagem'
        }
        tone={action === 'cancel' ? 'danger' : 'primary'}
        loading={activeMutation.isPending}
        onCancel={() => {
          setAction(null);
          activeMutation.reset();
        }}
        onConfirm={run}
      >
        {action === 'approve' && (
          <p>
            Vão ser criados {withDiff.length} ajustes de inventário, um por cada lote com diferença. A
            diferença é aplicada sobre a quantidade actual do lote. Esta operação fica registada com o seu
            nome.
          </p>
        )}
        {action === 'submit' && (
          <p>Depois de enviada, a contagem deixa de poder ser editada e aguarda aprovação.</p>
        )}
        {action === 'cancel' && (
          <p>A contagem é cancelada sem aplicar ajustes. O registo mantém-se no histórico.</p>
        )}
        {activeMutation.isError && <Notice tone="danger">{toUserMessage(activeMutation.error)}</Notice>}
      </ConfirmDialog>
    </>
  );
}

function CountInput({ item, onSave }: { item: StockCountItem; onSave: (value: number | null) => void }) {
  const initial = item.counted_quantity === null ? '' : String(item.counted_quantity);
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const commit = () => {
    if (value === initial) return;
    if (value.trim() === '') {
      setInvalid(false);
      onSave(null);
      return;
    }
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSave(n);
  };
  return (
    <Input
      aria-label="Quantidade contada"
      aria-invalid={invalid || undefined}
      className="ml-auto h-9 w-24 text-right tabular"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
