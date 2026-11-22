import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
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
import { Checkbox, Field, Input, Textarea } from '@/components/forms/Field';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useInvalidatePharmacy, useSuppliers } from '@/features/inventory/api';
import { supabase } from '@/lib/supabase/client';
import { can } from '@/lib/permissions';
import { supplierSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { Supplier } from '@/types/database';

export function SuppliersPage() {
  const { role } = usePharmacy();
  const suppliers = useSuppliers();
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);

  return (
    <>
      <PageHeader
        title="Fornecedores"
        description="Guarde apenas contactos profissionais necessários. Evite dados pessoais de representantes comerciais."
        actions={
          can(role, 'catalog.manage') && (
            <Button onClick={() => setEditing('new')} icon={<Icon name="plus" className="size-4" />}>
              Novo fornecedor
            </Button>
          )
        }
      />
      <Card>
        {suppliers.isPending ? (
          <LoadingState />
        ) : suppliers.isError ? (
          <ErrorState message={toUserMessage(suppliers.error)} onRetry={() => void suppliers.refetch()} />
        ) : suppliers.data.length ? (
          <DataTable
            rows={suppliers.data}
            rowKey={(s) => s.id}
            columns={[
              {
                header: 'Nome',
                cell: (s) => (
                  <span className="font-medium">
                    {s.name} {!s.is_active && <Badge>Inactivo</Badge>}
                  </span>
                ),
              },
              { header: 'Telefone', cell: (s) => s.phone ?? '—' },
              { header: 'Email', cell: (s) => s.email ?? '—', hideOnMobile: true },
              { header: 'Notas', cell: (s) => s.notes ?? '—', hideOnMobile: true },
              ...(can(role, 'catalog.manage')
                ? [
                    {
                      header: 'Acções',
                      cell: (s: Supplier) => (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                          Editar
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <EmptyState title="Ainda não há fornecedores">
            Pode registar entradas sem fornecedor e adicioná-los mais tarde.
          </EmptyState>
        )}
      </Card>
      {editing && (
        <SupplierDialog supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { pharmacyId } = usePharmacy();
  const { notify } = useToast();
  const invalidate = useInvalidatePharmacy();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof supplierSchema>, unknown, z.output<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      notes: supplier?.notes ?? '',
      is_active: supplier?.is_active ?? true,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = supplier
      ? await supabase.from('suppliers').update(values).eq('id', supplier.id).eq('pharmacy_id', pharmacyId)
      : await supabase.from('suppliers').insert({ ...values, pharmacy_id: pharmacyId });
    if (result.error) {
      setError(toUserMessage(result.error));
      return;
    }
    await invalidate();
    notify(supplier ? 'Fornecedor actualizado.' : 'Fornecedor registado.');
    onClose();
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={supplier ? 'Editar fornecedor' : 'Novo fornecedor'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="supplier-form" loading={isSubmitting} disabled={!online}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="supplier-form" noValidate onSubmit={onSubmit} className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Nome" required error={errors.name?.message}>
          {(p) => <Input {...p} autoFocus {...form.register('name')} />}
        </Field>
        <Field label="Telefone profissional" error={errors.phone?.message}>
          {(p) => <Input {...p} type="tel" {...form.register('phone')} />}
        </Field>
        <Field label="Email profissional" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" {...form.register('email')} />}
        </Field>
        <Field label="Notas" hint="Informação comercial mínima." error={errors.notes?.message}>
          {(p) => <Textarea {...p} maxLength={500} {...form.register('notes')} />}
        </Field>
        <Checkbox label="Fornecedor activo" {...form.register('is_active')} />
      </form>
    </Dialog>
  );
}
