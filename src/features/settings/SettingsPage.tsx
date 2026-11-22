import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { Button, Card, CardHeader, DefinitionList, Notice, PageHeader } from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Field, Input } from '@/components/forms/Field';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useAuditLogs } from '@/features/inventory/api';
import { supabase } from '@/lib/supabase/client';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { formatDateTime } from '@/lib/dates';
import { pharmacySettingsSchema, profileSchema, setPasswordSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { describeAudit } from './audit';

export function SettingsPage() {
  const { role } = usePharmacy();
  return (
    <>
      <PageHeader title="Definições" />
      <div className="grid gap-5 xl:grid-cols-2">
        <PharmacySettings editable={can(role, 'settings.manage')} />
        <div className="space-y-5">
          <ProfileSettings />
          <PasswordSettings />
        </div>
        {can(role, 'audit.read') && <AuditPanel />}
        <Card>
          <CardHeader title="Sobre o FarmaStock" />
          <div className="space-y-2 px-5 py-4 text-sm text-ink-soft">
            <p>
              O FarmaStock é um sistema <strong>interno</strong> de gestão de inventário. Não emite facturas,
              recibos ou documentos fiscais, não é um POS e não substitui o software de facturação da
              farmácia.
            </p>
            <p>
              Não regista dados de pacientes, receitas médicas nem informação clínica, e não faz recomendações
              terapêuticas.
            </p>
            <p>
              <Link to="/aviso-privacidade" className="text-brand-700 underline">
                Aviso de privacidade
              </Link>{' '}
              ·{' '}
              <Link to="/termos" className="text-brand-700 underline">
                Termos de utilização
              </Link>{' '}
              (versões preliminares)
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function PharmacySettings({ editable }: { editable: boolean }) {
  const { pharmacy } = usePharmacy();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<
    z.input<typeof pharmacySettingsSchema>,
    unknown,
    z.output<typeof pharmacySettingsSchema>
  >({
    resolver: zodResolver(pharmacySettingsSchema),
    defaultValues: {
      name: pharmacy.name,
      address: pharmacy.address ?? '',
      phone: pharmacy.phone ?? '',
      expiry_alert_days: pharmacy.expiry_alert_days.join(', '),
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const days = [...new Set(values.expiry_alert_days)].sort((a, b) => b - a);
    const { error: e } = await supabase
      .from('pharmacies')
      .update({ name: values.name, address: values.address, phone: values.phone, expiry_alert_days: days })
      .eq('id', pharmacy.id);
    if (e) {
      setError(toUserMessage(e));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    notify('Definições da farmácia guardadas.');
  });

  return (
    <Card>
      <CardHeader
        title="Farmácia"
        description={
          editable
            ? 'Dados básicos da unidade e janelas de alerta de validade.'
            : 'Só a administradora pode alterar estes dados.'
        }
      />
      <form noValidate onSubmit={onSubmit} className="space-y-4 px-5 py-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Nome da farmácia" required error={errors.name?.message}>
          {(p) => <Input {...p} disabled={!editable} {...form.register('name')} />}
        </Field>
        <Field label="Morada" error={errors.address?.message}>
          {(p) => <Input {...p} disabled={!editable} {...form.register('address')} />}
        </Field>
        <Field label="Telefone" error={errors.phone?.message}>
          {(p) => <Input {...p} type="tel" disabled={!editable} {...form.register('phone')} />}
        </Field>
        <Field
          label="Alertas de validade (dias antes)"
          hint="Separados por vírgulas. Ex.: 90, 60, 30."
          error={errors.expiry_alert_days?.message}
        >
          {(p) => <Input {...p} disabled={!editable} {...form.register('expiry_alert_days')} />}
        </Field>
        <DefinitionList
          items={[
            ['Fuso horário', pharmacy.timezone],
            ['Moeda', `${pharmacy.currency} (Kz), só para valores internos opcionais`],
            ['Formato de data', 'dd/MM/aaaa, 24 horas'],
          ]}
        />
        {editable && (
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!online}>
              Guardar
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function ProfileSettings() {
  const { userId, displayName, role } = usePharmacy();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const online = useOnlineStatus();
  const form = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { display_name: displayName ?? '' },
  });
  const [error, setError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit(async ({ display_name }) => {
    setError(null);
    const { error: e } = await supabase.from('user_profiles').update({ display_name }).eq('id', userId);
    if (e) {
      setError(toUserMessage(e));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    notify('Nome actualizado.');
  });

  return (
    <Card>
      <CardHeader title="O meu perfil" description={`Perfil nesta farmácia: ${ROLE_LABELS[role]}`} />
      <form noValidate onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 px-5 py-4">
        <Field
          label="Nome de apresentação"
          error={form.formState.errors.display_name?.message ?? error ?? undefined}
          className="min-w-60 flex-1"
        >
          {(p) => <Input {...p} {...form.register('display_name')} />}
        </Field>
        <Button type="submit" variant="secondary" loading={form.formState.isSubmitting} disabled={!online}>
          Guardar
        </Button>
      </form>
    </Card>
  );
}

function PasswordSettings() {
  const { notify } = useToast();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof setPasswordSchema>, unknown, z.output<typeof setPasswordSchema>>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    if (e) {
      setError(toUserMessage(e));
      return;
    }
    form.reset();
    notify('Palavra-passe alterada.');
  });
  return (
    <Card>
      <CardHeader
        title="Alterar palavra-passe"
        description="Pelo menos 12 caracteres, com maiúsculas, minúsculas e algarismos."
      />
      <form noValidate onSubmit={onSubmit} className="space-y-4 px-5 py-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova palavra-passe" error={form.formState.errors.password?.message}>
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" {...form.register('password')} />
            )}
          </Field>
          <Field label="Repetir" error={form.formState.errors.confirm?.message}>
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" {...form.register('confirm')} />
            )}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={form.formState.isSubmitting} disabled={!online}>
            Alterar palavra-passe
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AuditPanel() {
  const logs = useAuditLogs(undefined, 50);
  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="Registo de auditoria"
        description="Últimas 50 alterações relevantes nesta farmácia."
      />
      {logs.data?.length ? (
        <DataTable
          rows={logs.data}
          rowKey={(l) => l.id}
          columns={[
            {
              header: 'Data e hora',
              cell: (l) => <span className="whitespace-nowrap tabular">{formatDateTime(l.created_at)}</span>,
            },
            { header: 'Registo', cell: (l) => describeAudit(l) },
          ]}
        />
      ) : (
        <p className="px-5 py-6 text-sm text-muted">{logs.isPending ? 'A carregar…' : 'Sem registos.'}</p>
      )}
    </Card>
  );
}
