import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { Button, Card, ConfirmDialog, DefinitionList, Notice, PageHeader } from '@/components/ui';
import { Checkbox, Field, Input, Select } from '@/components/forms/Field';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useReceiveStock, useSuppliers } from '@/features/inventory/api';
import { ProductPicker } from '@/features/products/ProductPicker';
import { can } from '@/lib/permissions';
import { formatDate, todayIso } from '@/lib/dates';
import { formatKz } from '@/lib/currency';
import { formatQuantity } from '@/lib/stock';
import { receiptSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useIdempotencyKey } from '@/lib/idempotency';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { ProductStock } from '@/types/database';

type In = z.input<typeof receiptSchema>;
type Out = z.output<typeof receiptSchema>;

export function ReceiptPage() {
  const { role } = usePharmacy();
  const [params] = useSearchParams();
  const { notify } = useToast();
  const online = useOnlineStatus();
  const suppliers = useSuppliers(false);
  const receive = useReceiveStock();
  const [key, renewKey] = useIdempotencyKey();
  const [product, setProduct] = useState<ProductStock | undefined>();
  const [pending, setPending] = useState<Out | null>(null);
  const [last, setLast] = useState<{ productId: string; name: string } | null>(null);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      product_id: params.get('produto') ?? '',
      supplier_id: '',
      lot_number: '',
      no_expiry: false,
      expiry_date: '',
      quantity: '',
      purchase_unit_cost: '',
      reference_sale_price: '',
      reference: '',
    },
  });
  const { errors } = form.formState;
  const noExpiry = form.watch('no_expiry');

  if (!can(role, 'stock.move')) {
    return (
      <Notice tone="warning" title="Sem permissão">
        O seu perfil só permite consultar o inventário.
      </Notice>
    );
  }

  const confirm = () => {
    if (!pending) return;
    receive.mutate(
      {
        p_product_id: pending.product_id,
        p_lot_number: pending.lot_number,
        p_expiry_date: pending.no_expiry ? null : pending.expiry_date,
        p_quantity: pending.quantity,
        p_idempotency_key: key,
        p_supplier_id: pending.supplier_id,
        p_purchase_unit_cost: pending.purchase_unit_cost ?? null,
        p_reference_sale_price: pending.reference_sale_price ?? null,
        p_reference: pending.reference,
      },
      {
        onSuccess: () => {
          notify('Entrada registada e stock actualizado.');
          setLast({ productId: pending.product_id, name: product?.name ?? 'produto' });
          setPending(null);
          renewKey();
          form.reset({
            ...form.getValues(),
            lot_number: '',
            expiry_date: '',
            quantity: '',
            reference: '',
            no_expiry: false,
          });
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Registar entrada de stock"
        description="Recepção de mercadoria por lote. O valor de custo é opcional e serve apenas para controlo interno: não gera documentos contabilísticos ou fiscais."
      />
      {last && (
        <Notice tone="success" className="mb-4">
          Entrada de <strong>{last.name}</strong> registada.{' '}
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
                onChange={(id, p) => {
                  field.onChange(id);
                  setProduct(p);
                }}
                error={errors.product_id?.message}
              />
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Fornecedor" hint="Opcional." error={errors.supplier_id?.message}>
              {(p) => (
                <Select {...p} {...form.register('supplier_id')}>
                  <option value="">Sem fornecedor indicado</option>
                  {(suppliers.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Número do lote" required error={errors.lot_number?.message}>
              {(p) => <Input {...p} autoCapitalize="characters" {...form.register('lot_number')} />}
            </Field>
            <Field label="Data de validade" required={!noExpiry} error={errors.expiry_date?.message}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={todayIso()}
                  disabled={noExpiry}
                  {...form.register('expiry_date')}
                />
              )}
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox
                label="Produto sem data de validade"
                hint="Ex.: algum material de penso."
                {...form.register('no_expiry')}
              />
            </div>
            <Field
              label={`Quantidade recebida${product ? ` (${product.unit_name})` : ''}`}
              required
              error={errors.quantity?.message}
            >
              {(p) => <Input {...p} inputMode="decimal" {...form.register('quantity')} />}
            </Field>
            <Field
              label="Referência interna"
              hint="Ex.: n.º da guia de remessa. Sem dados de pacientes."
              error={errors.reference?.message}
            >
              {(p) => <Input {...p} {...form.register('reference')} />}
            </Field>
            <Field
              label="Custo unitário de aquisição (Kz)"
              hint="Opcional, uso interno."
              error={errors.purchase_unit_cost?.message}
            >
              {(p) => <Input {...p} inputMode="decimal" {...form.register('purchase_unit_cost')} />}
            </Field>
            <Field
              label="Preço de referência (Kz)"
              hint="Opcional e informativo. Não é preço fiscal."
              error={errors.reference_sale_price?.message}
            >
              {(p) => <Input {...p} inputMode="decimal" {...form.register('reference_sale_price')} />}
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
        title="Confirmar entrada"
        confirmLabel="Confirmar entrada"
        loading={receive.isPending}
        onCancel={() => {
          setPending(null);
          receive.reset();
        }}
        onConfirm={confirm}
      >
        {pending && (
          <>
            <DefinitionList
              items={[
                [
                  'Produto',
                  product ? `${product.name}${product.strength ? ` ${product.strength}` : ''}` : '—',
                ],
                ['Lote', pending.lot_number.toUpperCase()],
                ['Validade', pending.no_expiry ? 'Sem validade' : formatDate(pending.expiry_date)],
                ['Quantidade', formatQuantity(pending.quantity, product?.unit_name)],
                ['Fornecedor', suppliers.data?.find((s) => s.id === pending.supplier_id)?.name ?? '—'],
                ['Custo unitário', formatKz(pending.purchase_unit_cost)],
              ]}
            />
            {receive.isError && <Notice tone="danger">{toUserMessage(receive.error)}</Notice>}
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
