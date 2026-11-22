import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router';
import type { z } from 'zod';
import { Button, ButtonLink, Card, ErrorState, LoadingState, Notice, PageHeader } from '@/components/ui';
import { Checkbox, Field, Input, Textarea } from '@/components/forms/Field';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useInvalidatePharmacy, useProduct } from '@/features/inventory/api';
import { supabase } from '@/lib/supabase/client';
import { can } from '@/lib/permissions';
import { productSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type Input = z.input<typeof productSchema>;
type Output = z.output<typeof productSchema>;

const DOSAGE_FORMS = [
  'Comprimido',
  'Cápsula',
  'Xarope',
  'Suspensão oral',
  'Solução',
  'Pó para solução oral',
  'Creme',
  'Pomada',
  'Gotas',
  'Injectável',
  'Supositório',
  'Saqueta',
];
const UNITS = ['unidade', 'caixa', 'frasco', 'embalagem', 'saqueta', 'tubo', 'ampola', 'pacote'];

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const { role, pharmacyId, userId } = usePharmacy();
  const navigate = useNavigate();
  const { notify } = useToast();
  const invalidate = useInvalidatePharmacy();
  const online = useOnlineStatus();
  const product = useProduct(id);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', unit_name: 'caixa', minimum_stock: '0', is_active: true },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (product.data) {
      const p = product.data;
      form.reset({
        name: p.name,
        active_ingredient: p.active_ingredient ?? '',
        brand: p.brand ?? '',
        strength: p.strength ?? '',
        dosage_form: p.dosage_form ?? '',
        presentation: p.presentation ?? '',
        unit_name: p.unit_name,
        barcode: p.barcode ?? '',
        internal_code: p.internal_code ?? '',
        category: p.category ?? '',
        minimum_stock: String(p.minimum_stock),
        notes: p.notes ?? '',
        is_active: p.is_active,
      });
    }
  }, [product.data, form]);

  if (!can(role, 'catalog.manage')) {
    return (
      <Notice tone="warning" title="Sem permissão">
        Só a administradora ou o gestor podem criar e editar produtos.
      </Notice>
    );
  }
  if (isEdit && product.isPending) return <LoadingState />;
  if (isEdit && (product.isError || !product.data)) {
    return (
      <ErrorState message={product.isError ? toUserMessage(product.error) : 'Produto não encontrado.'} />
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = isEdit
      ? await supabase
          .from('products')
          .update(values)
          .eq('id', id)
          .eq('pharmacy_id', pharmacyId)
          .select('id')
          .single()
      : await supabase
          .from('products')
          .insert({ ...values, pharmacy_id: pharmacyId, created_by: userId })
          .select('id')
          .single();
    if (result.error) {
      setError(toUserMessage(result.error));
      return;
    }
    await invalidate();
    notify(isEdit ? 'Produto actualizado.' : 'Produto registado.');
    navigate(`/produtos/${result.data.id}`, { replace: true });
  });

  return (
    <>
      <PageHeader
        title={isEdit ? `Editar: ${product.data?.name}` : 'Novo produto'}
        description="Registe apenas informação de inventário. Não crie campos nem notas com dados de pacientes, receitas ou informação clínica."
      />
      <Card className="max-w-4xl">
        <form onSubmit={onSubmit} noValidate className="space-y-6 px-4 py-5 sm:px-6">
          {error && <Notice tone="danger">{error}</Notice>}

          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-ink">Identificação</legend>
            <Field label="Nome comercial" required error={errors.name?.message} className="md:col-span-2">
              {(p) => <Input {...p} {...form.register('name')} autoFocus />}
            </Field>
            <Field label="Princípio activo" hint="Se aplicável." error={errors.active_ingredient?.message}>
              {(p) => <Input {...p} {...form.register('active_ingredient')} />}
            </Field>
            <Field label="Marca / laboratório" error={errors.brand?.message}>
              {(p) => <Input {...p} {...form.register('brand')} />}
            </Field>
            <Field
              label="Dosagem / concentração"
              hint="Ex.: 500 mg, 50 mg/ml."
              error={errors.strength?.message}
            >
              {(p) => <Input {...p} {...form.register('strength')} />}
            </Field>
            <Field label="Forma farmacêutica" error={errors.dosage_form?.message}>
              {(p) => (
                <>
                  <Input {...p} list="dosage-forms" {...form.register('dosage_form')} />
                  <datalist id="dosage-forms">
                    {DOSAGE_FORMS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field
              label="Apresentação"
              hint="Ex.: embalagem de 20 comprimidos."
              error={errors.presentation?.message}
            >
              {(p) => <Input {...p} {...form.register('presentation')} />}
            </Field>
            <Field label="Categoria" error={errors.category?.message}>
              {(p) => <Input {...p} {...form.register('category')} />}
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 md:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold text-ink">Controlo de stock</legend>
            <Field
              label="Unidade de controlo"
              required
              hint="Em que unidade conta o stock."
              error={errors.unit_name?.message}
            >
              {(p) => (
                <>
                  <Input {...p} list="units" {...form.register('unit_name')} />
                  <datalist id="units">
                    {UNITS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field
              label="Stock mínimo"
              hint="Abaixo ou igual a este valor gera alerta."
              error={errors.minimum_stock?.message}
            >
              {(p) => <Input {...p} inputMode="decimal" {...form.register('minimum_stock')} />}
            </Field>
            <div />
            <Field label="Código interno" hint="Único na farmácia." error={errors.internal_code?.message}>
              {(p) => <Input {...p} {...form.register('internal_code')} />}
            </Field>
            <Field label="Código de barras" hint="Opcional." error={errors.barcode?.message}>
              {(p) => <Input {...p} inputMode="numeric" {...form.register('barcode')} />}
            </Field>
          </fieldset>

          <Field
            label="Observações internas"
            hint="Apenas notas operacionais (ex.: local de arrumação). Não introduza dados de pacientes nem informação clínica."
            error={errors.notes?.message}
          >
            {(p) => <Textarea {...p} maxLength={500} {...form.register('notes')} />}
          </Field>

          <Checkbox
            label="Produto activo"
            hint="Um produto inactivo deixa de aparecer nas listas e não recebe entradas. O histórico mantém-se."
            {...form.register('is_active')}
          />

          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <ButtonLink to={isEdit ? `/produtos/${id}` : '/produtos'} variant="secondary">
              Cancelar
            </ButtonLink>
            <Button type="submit" loading={isSubmitting} disabled={!online}>
              {isEdit ? 'Guardar alterações' : 'Registar produto'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
