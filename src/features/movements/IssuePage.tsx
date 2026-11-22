import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router';
import type { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DefinitionList,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  cx,
} from '@/components/ui';
import { Field, Input, Select, Textarea } from '@/components/forms/Field';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useBatches, useIssueStock } from '@/features/inventory/api';
import { BatchStatusBadge, ExpiryBadge } from '@/features/inventory/badges';
import { ProductPicker } from '@/features/products/ProductPicker';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/dates';
import { formatQuantity, ISSUE_TYPES, sortFefo } from '@/lib/stock';
import { issueSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useIdempotencyKey } from '@/lib/idempotency';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { MovementType, ProductStock } from '@/types/database';

type In = z.input<typeof issueSchema>;
type Out = z.output<typeof issueSchema>;

export function IssuePage() {
  const { role } = usePharmacy();
  const [params] = useSearchParams();
  const { notify } = useToast();
  const online = useOnlineStatus();
  const issue = useIssueStock();
  const [key, renewKey] = useIdempotencyKey();
  const [product, setProduct] = useState<ProductStock | undefined>();
  const [pending, setPending] = useState<Out | null>(null);
  const [last, setLast] = useState<{ productId: string; name: string } | null>(null);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      product_id: params.get('produto') ?? '',
      batch_id: params.get('lote') ?? '',
      movement_type: 'issue',
      quantity: '',
      reason: '',
      reference: '',
    },
  });
  const { errors } = form.formState;
  const productId = form.watch('product_id');
  const batchId = form.watch('batch_id');
  const type = form.watch('movement_type');
  const typeInfo = ISSUE_TYPES.find((t) => t.value === type);

  const batches = useBatches({ productId: productId || undefined, withStockOnly: true });
  const sorted = useMemo(() => (productId ? sortFefo(batches.data ?? []) : []), [batches.data, productId]);
  const selectable = (b: (typeof sorted)[number]) => !typeInfo?.normal || b.effective_status === 'active';
  const fefo = sorted.find((b) => b.effective_status === 'active');
  const selected = sorted.find((b) => b.id === batchId);

  if (!can(role, 'stock.move')) {
    return (
      <Notice tone="warning" title="Sem permissão">
        O seu perfil só permite consultar o inventário.
      </Notice>
    );
  }

  const confirm = () => {
    if (!pending) return;
    issue.mutate(
      {
        p_batch_id: pending.batch_id,
        p_quantity: pending.quantity,
        p_movement_type: pending.movement_type as MovementType,
        p_idempotency_key: key,
        p_reason: pending.reason || null,
        p_reference: pending.reference,
      },
      {
        onSuccess: () => {
          notify('Saída registada e stock actualizado.');
          setLast({
            productId: pending.product_id,
            name: product?.name ?? selected?.product_name ?? 'produto',
          });
          setPending(null);
          renewKey();
          form.reset({ ...form.getValues(), batch_id: '', quantity: '', reason: '', reference: '' });
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Registar saída de stock"
        description="Retira quantidade de um lote. Não regista vendas, recibos nem dados de pacientes: a venda continua no sistema de facturação da farmácia."
      />
      {last && (
        <Notice tone="success" className="mb-4">
          Saída de <strong>{last.name}</strong> registada.{' '}
          <Link to={`/produtos/${last.productId}`} className="font-medium underline">
            Ver produto
          </Link>
        </Notice>
      )}
      <Card className="max-w-4xl">
        <form noValidate onSubmit={form.handleSubmit(setPending)} className="space-y-5 px-4 py-5 sm:px-6">
          <Controller
            control={form.control}
            name="product_id"
            render={({ field }) => (
              <ProductPicker
                value={field.value}
                onlyWithStock
                onChange={(id, p) => {
                  field.onChange(id);
                  setProduct(p);
                  form.setValue('batch_id', '');
                }}
                error={errors.product_id?.message}
              />
            )}
          />

          <Field label="Motivo da saída" required error={errors.movement_type?.message}>
            {(p) => (
              <Select {...p} {...form.register('movement_type')}>
                {ISSUE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {productId && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-soft">
                Lote <span className="text-danger-600">*</span>
              </legend>
              {batches.isPending ? (
                <LoadingState label="A carregar lotes…" />
              ) : !sorted.length ? (
                <EmptyState title="Este produto não tem lotes com stock" />
              ) : (
                <>
                  {fefo && typeInfo?.normal && (
                    <p className="mb-2 text-xs text-muted">
                      Sugestão FEFO (primeiro a expirar, primeiro a sair): lote{' '}
                      <strong>{fefo.lot_number}</strong>. A decisão final é do farmacêutico responsável.
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sorted.map((b) => {
                      const ok = selectable(b);
                      return (
                        <label
                          key={b.id}
                          className={cx(
                            'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm',
                            batchId === b.id
                              ? 'border-brand-600 bg-brand-50'
                              : 'border-line hover:border-line-strong',
                            !ok && 'cursor-not-allowed opacity-55',
                          )}
                        >
                          <input
                            type="radio"
                            value={b.id}
                            disabled={!ok}
                            className="mt-1 accent-brand-700"
                            {...form.register('batch_id')}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-medium">{b.lot_number}</span>
                              {fefo?.id === b.id && typeInfo?.normal && <Badge tone="brand">FEFO</Badge>}
                              {b.effective_status !== 'active' && (
                                <BatchStatusBadge status={b.effective_status} />
                              )}
                            </span>
                            <span className="mt-0.5 block text-muted">
                              Validade {formatDate(b.expiry_date)} · disponível{' '}
                              {formatQuantity(b.available_quantity, b.unit_name)}
                            </span>
                            {b.effective_status === 'active' && <ExpiryBadge date={b.expiry_date} />}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {typeInfo?.normal && sorted.some((b) => !selectable(b)) && (
                    <p className="mt-2 text-xs text-muted">
                      Lotes expirados ou bloqueados não podem ser usados nesta saída. Use “Eliminação por
                      validade” ou “Devolução ao fornecedor”.
                    </p>
                  )}
                </>
              )}
              {errors.batch_id && <p className="mt-1 text-sm text-danger-600">{errors.batch_id.message}</p>}
            </fieldset>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label={`Quantidade a retirar${selected ? ` (disponível: ${formatQuantity(selected.available_quantity, selected.unit_name)})` : ''}`}
              required
              error={errors.quantity?.message}
            >
              {(p) => <Input {...p} inputMode="decimal" {...form.register('quantity')} />}
            </Field>
            <Field
              label="Referência"
              hint="Opcional. Sem nomes de pacientes nem números de facturas."
              error={errors.reference?.message}
            >
              {(p) => <Input {...p} {...form.register('reference')} />}
            </Field>
            <Field
              label="Observação / motivo"
              required={typeInfo?.reasonRequired}
              hint="Motivo operacional. Não indique o nome do paciente nem a razão clínica."
              error={errors.reason?.message}
              className="md:col-span-2"
            >
              {(p) => <Textarea {...p} maxLength={300} {...form.register('reason')} />}
            </Field>
          </div>
          <div className="flex justify-end border-t border-line pt-4">
            <Button type="submit" disabled={!online}>
              Rever e confirmar
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        open={!!pending}
        title="Confirmar saída"
        confirmLabel="Confirmar saída"
        tone={typeInfo?.normal ? 'primary' : 'danger'}
        loading={issue.isPending}
        onCancel={() => {
          setPending(null);
          issue.reset();
        }}
        onConfirm={confirm}
      >
        {pending && selected && (
          <>
            <DefinitionList
              items={[
                ['Produto', selected.product_name],
                ['Lote', selected.lot_number],
                ['Motivo', typeInfo?.label ?? pending.movement_type],
                ['Quantidade', formatQuantity(pending.quantity, selected.unit_name)],
                [
                  'Fica disponível',
                  formatQuantity(Number(selected.available_quantity) - pending.quantity, selected.unit_name),
                ],
                ...(pending.reason ? ([['Observação', pending.reason]] as [string, string][]) : []),
              ]}
            />
            {pending.quantity > Number(selected.available_quantity) && (
              <Notice tone="warning">
                A quantidade é superior à disponível. O servidor vai recusar a operação.
              </Notice>
            )}
            {issue.isError && <Notice tone="danger">{toUserMessage(issue.error)}</Notice>}
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
