import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import type { z } from 'zod';
import { Badge, Button, DefinitionList, Dialog, Notice } from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Field, Textarea } from '@/components/forms/Field';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useReverseMovement } from '@/features/inventory/api';
import { MovementTypeBadge } from '@/features/inventory/badges';
import { can } from '@/lib/permissions';
import { formatDateTime } from '@/lib/dates';
import { formatQuantity, MOVEMENT_LABELS, movementSign } from '@/lib/stock';
import { reasonSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useIdempotencyKey } from '@/lib/idempotency';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { MovementOverview } from '@/types/database';

export function MovementTable({
  movements,
  showProduct = true,
}: {
  movements: MovementOverview[];
  showProduct?: boolean;
}) {
  const { role } = usePharmacy();
  const [reversing, setReversing] = useState<MovementOverview | null>(null);

  return (
    <>
      <DataTable
        rows={movements}
        rowKey={(m) => m.id}
        caption="Movimentos de stock"
        columns={[
          {
            header: 'Data e hora',
            cell: (m) => <span className="whitespace-nowrap tabular">{formatDateTime(m.created_at)}</span>,
          },
          {
            header: 'Tipo',
            cell: (m) => (
              <div className="flex flex-wrap gap-1">
                <MovementTypeBadge type={m.movement_type} />
                {m.reverses_movement_id && <Badge tone="info">Correcção</Badge>}
                {m.is_reversed && <Badge>Corrigido</Badge>}
              </div>
            ),
          },
          ...(showProduct
            ? [
                {
                  header: 'Produto',
                  cell: (m: MovementOverview) => (
                    <Link to={`/produtos/${m.product_id}`} className="font-medium hover:underline">
                      {m.product_name}
                    </Link>
                  ),
                },
              ]
            : []),
          {
            header: 'Lote',
            cell: (m) => <span className="font-mono text-[13px]">{m.lot_number ?? '—'}</span>,
          },
          {
            header: 'Quantidade',
            align: 'right',
            cell: (m) => (
              <span
                className={
                  movementSign(m.movement_type) > 0 ? 'font-semibold text-brand-700' : 'font-semibold'
                }
              >
                {movementSign(m.movement_type) > 0 ? '+' : '−'}
                {formatQuantity(m.quantity, m.unit_name)}
              </span>
            ),
          },
          {
            header: 'Antes → depois',
            align: 'right',
            cell: (m) => `${formatQuantity(m.quantity_before)} → ${formatQuantity(m.quantity_after)}`,
            hideOnMobile: true,
          },
          { header: 'Utilizador', cell: (m) => m.created_by_name ?? '—', hideOnMobile: true },
          {
            header: 'Motivo / referência',
            cell: (m) => (
              <span className="block max-w-64 text-ink-soft">
                {[m.reason, m.reference].filter(Boolean).join(' · ') || '—'}
              </span>
            ),
            hideOnMobile: true,
          },
          ...(can(role, 'stock.adjust')
            ? [
                {
                  header: 'Acções',
                  cell: (m: MovementOverview) =>
                    !m.reverses_movement_id && !m.is_reversed && m.batch_id ? (
                      <Button size="sm" variant="ghost" onClick={() => setReversing(m)}>
                        Corrigir
                      </Button>
                    ) : null,
                },
              ]
            : []),
        ]}
      />
      {reversing && <ReverseDialog movement={reversing} onClose={() => setReversing(null)} />}
    </>
  );
}

function ReverseDialog({ movement, onClose }: { movement: MovementOverview; onClose: () => void }) {
  const { notify } = useToast();
  const online = useOnlineStatus();
  const reverse = useReverseMovement();
  const [key] = useIdempotencyKey();
  const form = useForm<z.input<typeof reasonSchema>, unknown, z.output<typeof reasonSchema>>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: '' },
  });

  const onSubmit = form.handleSubmit(({ reason }) =>
    reverse.mutate(
      { p_movement_id: movement.id, p_reason: reason, p_idempotency_key: key },
      {
        onSuccess: () => {
          notify('Movimento correctivo registado.');
          onClose();
        },
      },
    ),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Corrigir movimento"
      description="Cria um movimento inverso. O movimento original não é apagado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="reverse-form" loading={reverse.isPending} disabled={!online}>
            Registar correcção
          </Button>
        </>
      }
    >
      <form id="reverse-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <DefinitionList
          items={[
            ['Movimento', MOVEMENT_LABELS[movement.movement_type]],
            ['Produto', movement.product_name],
            ['Lote', movement.lot_number ?? '—'],
            ['Quantidade', formatQuantity(movement.quantity, movement.unit_name)],
            ['Registado em', `${formatDateTime(movement.created_at)} por ${movement.created_by_name ?? '—'}`],
          ]}
        />
        <Field label="Motivo da correcção" required error={form.formState.errors.reason?.message}>
          {(p) => <Textarea {...p} maxLength={300} autoFocus {...form.register('reason')} />}
        </Field>
        {reverse.isError && <Notice tone="danger">{toUserMessage(reverse.error)}</Notice>}
      </form>
    </Dialog>
  );
}
