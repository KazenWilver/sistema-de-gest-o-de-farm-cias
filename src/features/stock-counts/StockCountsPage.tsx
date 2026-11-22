import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
} from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Field, Textarea } from '@/components/forms/Field';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useStartStockCount, useStockCounts } from '@/features/inventory/api';
import { can } from '@/lib/permissions';
import { formatDateTime } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { StockCountStatus } from '@/types/database';

export const COUNT_STATUS: Record<
  StockCountStatus,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' }
> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  in_progress: { label: 'Em curso', tone: 'info' },
  review: { label: 'Aguarda aprovação', tone: 'warning' },
  completed: { label: 'Concluída', tone: 'success' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

export function StockCountsPage() {
  const { role } = usePharmacy();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const counts = useStockCounts();
  const start = useStartStockCount();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const hasOpen = counts.data?.some((c) => ['draft', 'in_progress', 'review'].includes(c.status));

  return (
    <>
      <PageHeader
        title="Contagem de inventário"
        description="Compare o stock do sistema com as prateleiras. As diferenças só são aplicadas depois de aprovadas pelo gestor ou pela administradora."
        actions={
          can(role, 'stock.move') && (
            <Button onClick={() => setOpen(true)} disabled={!!hasOpen || !online}>
              Iniciar contagem
            </Button>
          )
        }
      />
      {hasOpen && (
        <Notice tone="info" className="mb-4">
          Existe uma contagem em aberto. Conclua-a ou cancele-a antes de iniciar outra.
        </Notice>
      )}
      <Card>
        {counts.isPending ? (
          <LoadingState />
        ) : counts.isError ? (
          <ErrorState message={toUserMessage(counts.error)} onRetry={() => void counts.refetch()} />
        ) : counts.data.length ? (
          <DataTable
            rows={counts.data}
            rowKey={(c) => c.id}
            columns={[
              {
                header: 'Iniciada em',
                cell: (c) => (
                  <Link to={`/contagens/${c.id}`} className="font-medium hover:underline">
                    {formatDateTime(c.started_at)}
                  </Link>
                ),
              },
              {
                header: 'Estado',
                cell: (c) => <Badge tone={COUNT_STATUS[c.status].tone}>{COUNT_STATUS[c.status].label}</Badge>,
              },
              { header: 'Concluída em', cell: (c) => formatDateTime(c.completed_at), hideOnMobile: true },
              { header: 'Notas', cell: (c) => c.notes ?? '—', hideOnMobile: true },
            ]}
          />
        ) : (
          <EmptyState title="Ainda não há contagens">
            Uma contagem cria uma lista de todos os lotes com stock para registar a quantidade observada.
          </EmptyState>
        )}
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Iniciar contagem"
        description="É criada uma linha por cada lote com stock, com a quantidade actual do sistema."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={start.isPending}
              onClick={() =>
                start.mutate(
                  { p_notes: notes || null },
                  { onSuccess: (count) => navigate(`/contagens/${String(count.id)}`) },
                )
              }
            >
              Iniciar
            </Button>
          </>
        }
      >
        <Field label="Notas" hint="Opcional. Ex.: contagem mensal, zona de armazém.">
          {(p) => (
            <Textarea {...p} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
          )}
        </Field>
        {start.isError && (
          <Notice tone="danger" className="mt-3">
            {toUserMessage(start.error)}
          </Notice>
        )}
      </Dialog>
    </>
  );
}
