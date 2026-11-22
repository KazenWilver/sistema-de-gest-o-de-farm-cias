import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import type { z } from 'zod';
import { Button, ButtonLink, DefinitionList, Dialog, Notice } from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Field, Input, Textarea } from '@/components/forms/Field';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useAdjustStock, useSetBatchStatus } from '@/features/inventory/api';
import { BatchStatusBadge, ExpiryBadge } from '@/features/inventory/badges';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/dates';
import { formatKz } from '@/lib/currency';
import { formatQuantity } from '@/lib/stock';
import { adjustmentSchema, reasonSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useIdempotencyKey } from '@/lib/idempotency';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { BatchOverview } from '@/types/database';

export function BatchTable({
  batches,
  showProduct = true,
}: {
  batches: BatchOverview[];
  showProduct?: boolean;
}) {
  const { role } = usePharmacy();
  const [adjusting, setAdjusting] = useState<BatchOverview | null>(null);
  const [toggling, setToggling] = useState<BatchOverview | null>(null);

  return (
    <>
      <DataTable
        rows={batches}
        rowKey={(b) => b.id}
        caption="Lotes"
        rowClassName={(b) =>
          b.effective_status === 'expired' || b.effective_status === 'blocked' ? 'bg-danger-50/40' : undefined
        }
        columns={[
          ...(showProduct
            ? [
                {
                  header: 'Produto',
                  cell: (b: BatchOverview) => (
                    <Link to={`/produtos/${b.product_id}`} className="font-medium hover:underline">
                      {b.product_name}
                      {b.product_strength && (
                        <span className="font-normal text-muted"> {b.product_strength}</span>
                      )}
                    </Link>
                  ),
                },
              ]
            : []),
          { header: 'Lote', cell: (b) => <span className="font-mono text-[13px]">{b.lot_number}</span> },
          {
            header: 'Validade',
            cell: (b) => (
              <div className="space-y-0.5">
                <p className="tabular">{formatDate(b.expiry_date)}</p>
                {b.available_quantity > 0 && <ExpiryBadge date={b.expiry_date} />}
              </div>
            ),
          },
          {
            header: 'Disponível',
            align: 'right',
            cell: (b) => (
              <span className="font-semibold">{formatQuantity(b.available_quantity, b.unit_name)}</span>
            ),
          },
          {
            header: 'Recebido',
            align: 'right',
            cell: (b) => formatQuantity(b.received_quantity),
            hideOnMobile: true,
          },
          { header: 'Fornecedor', cell: (b) => b.supplier_name ?? '—', hideOnMobile: true },
          {
            header: 'Preço ref. (interno)',
            align: 'right',
            cell: (b) => formatKz(b.reference_sale_price),
            hideOnMobile: true,
          },
          {
            header: 'Estado',
            cell: (b) => (
              <div className="space-y-0.5">
                <BatchStatusBadge status={b.effective_status} />
                {b.status === 'blocked' && b.status_reason && (
                  <p className="max-w-48 text-xs text-muted">{b.status_reason}</p>
                )}
              </div>
            ),
          },
          {
            header: 'Acções',
            cell: (b) => (
              <div className="flex flex-wrap gap-1">
                {can(role, 'stock.move') && b.available_quantity > 0 && (
                  <ButtonLink
                    to={`/movimentos/saida?produto=${b.product_id}&lote=${b.id}`}
                    size="sm"
                    variant="ghost"
                  >
                    Saída
                  </ButtonLink>
                )}
                {can(role, 'stock.adjust') && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setAdjusting(b)}>
                      Ajustar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToggling(b)}>
                      {b.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
      {adjusting && <AdjustDialog batch={adjusting} onClose={() => setAdjusting(null)} />}
      {toggling && <BlockDialog batch={toggling} onClose={() => setToggling(null)} />}
    </>
  );
}

function AdjustDialog({ batch, onClose }: { batch: BatchOverview; onClose: () => void }) {
  const { notify } = useToast();
  const online = useOnlineStatus();
  const adjust = useAdjustStock();
  const [key] = useIdempotencyKey();
  const [confirming, setConfirming] = useState<z.output<typeof adjustmentSchema> | null>(null);
  const form = useForm<z.input<typeof adjustmentSchema>, unknown, z.output<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { new_quantity: String(batch.available_quantity), reason: '' },
  });

  const submit = () => {
    if (!confirming) return;
    adjust.mutate(
      {
        p_batch_id: batch.id,
        p_new_quantity: confirming.new_quantity,
        p_reason: confirming.reason,
        p_idempotency_key: key,
      },
      {
        onSuccess: () => {
          notify('Ajuste registado.');
          onClose();
        },
      },
    );
  };

  const diff = confirming ? confirming.new_quantity - Number(batch.available_quantity) : 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={confirming ? 'Confirmar ajuste' : 'Ajustar quantidade do lote'}
      description={`${batch.product_name} · lote ${batch.lot_number}`}
      footer={
        confirming ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={adjust.isPending}>
              Voltar
            </Button>
            <Button onClick={submit} loading={adjust.isPending} disabled={!online}>
              Confirmar ajuste
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="adjust-form">
              Continuar
            </Button>
          </>
        )
      }
    >
      {confirming ? (
        <div className="space-y-3">
          <DefinitionList
            items={[
              ['Quantidade actual', formatQuantity(batch.available_quantity, batch.unit_name)],
              ['Nova quantidade', formatQuantity(confirming.new_quantity, batch.unit_name)],
              ['Diferença', `${diff > 0 ? '+' : ''}${formatQuantity(diff)}`],
              ['Motivo', confirming.reason],
            ]}
          />
          <p className="text-xs text-muted">
            O ajuste fica registado com o seu nome, a data e a hora. Não apaga movimentos anteriores.
          </p>
          {adjust.isError && <Notice tone="danger">{toUserMessage(adjust.error)}</Notice>}
        </div>
      ) : (
        <form id="adjust-form" noValidate onSubmit={form.handleSubmit(setConfirming)} className="space-y-4">
          <p className="text-sm text-ink-soft">
            Quantidade actual no sistema:{' '}
            <strong>{formatQuantity(batch.available_quantity, batch.unit_name)}</strong>
          </p>
          <Field
            label="Quantidade real (nova quantidade)"
            required
            error={form.formState.errors.new_quantity?.message}
          >
            {(p) => <Input {...p} inputMode="decimal" autoFocus {...form.register('new_quantity')} />}
          </Field>
          <Field
            label="Motivo do ajuste"
            required
            hint="Sem dados de pacientes."
            error={form.formState.errors.reason?.message}
          >
            {(p) => <Textarea {...p} maxLength={300} {...form.register('reason')} />}
          </Field>
        </form>
      )}
    </Dialog>
  );
}

function BlockDialog({ batch, onClose }: { batch: BatchOverview; onClose: () => void }) {
  const { notify } = useToast();
  const online = useOnlineStatus();
  const setStatus = useSetBatchStatus();
  const blocking = batch.status !== 'blocked';
  const form = useForm<z.input<typeof reasonSchema>, unknown, z.output<typeof reasonSchema>>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: '' },
  });

  const onSubmit = form.handleSubmit(({ reason }) =>
    setStatus.mutate(
      { p_batch_id: batch.id, p_status: blocking ? 'blocked' : 'active', p_reason: reason },
      {
        onSuccess: () => {
          notify(blocking ? 'Lote bloqueado.' : 'Lote desbloqueado.');
          onClose();
        },
      },
    ),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={blocking ? 'Bloquear / retirar lote' : 'Desbloquear lote'}
      description={`${batch.product_name} · lote ${batch.lot_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="block-form"
            variant={blocking ? 'danger' : 'primary'}
            loading={setStatus.isPending}
            disabled={!online}
          >
            {blocking ? 'Bloquear lote' : 'Desbloquear lote'}
          </Button>
        </>
      }
    >
      <form id="block-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          {blocking
            ? 'Um lote bloqueado deixa de poder ser usado em saídas normais e não conta para o stock disponível.'
            : 'O lote volta a poder ser usado em saídas, se estiver dentro da validade.'}
        </p>
        <Field label="Motivo" required error={form.formState.errors.reason?.message}>
          {(p) => <Textarea {...p} maxLength={300} autoFocus {...form.register('reason')} />}
        </Field>
        {setStatus.isError && <Notice tone="danger">{toUserMessage(setStatus.error)}</Notice>}
      </form>
    </Dialog>
  );
}
