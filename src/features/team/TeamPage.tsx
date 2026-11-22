import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
} from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Field, Input, Select } from '@/components/forms/Field';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/feedback/Toaster';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useMembers, useTeamAdmin, useUpdateMemberRole } from '@/features/inventory/api';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { formatDateTime } from '@/lib/dates';
import { inviteSchema } from '@/lib/validation/schemas';
import { toUserMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { MemberRole, TeamMember } from '@/types/database';

const ROLE_HELP: Record<MemberRole, string> = {
  owner: 'Acesso total, gere utilizadores e definições.',
  manager: 'Produtos, lotes, movimentos, ajustes, contagens, relatórios e auditoria.',
  stock_operator: 'Entradas, saídas, contagens e consulta. Sem ajustes nem gestão de contas.',
  viewer: 'Só consulta do inventário e dos alertas.',
};

export function TeamPage() {
  const { role, userId } = usePharmacy();
  const members = useMembers();
  const [inviting, setInviting] = useState(false);
  const [toggling, setToggling] = useState<TeamMember | null>(null);
  const teamAdmin = useTeamAdmin();
  const updateRole = useUpdateMemberRole();
  const { notify } = useToast();
  const online = useOnlineStatus();

  if (!can(role, 'team.manage')) {
    return (
      <Notice tone="warning" title="Sem permissão">
        Só a administradora da farmácia pode gerir utilizadores.
      </Notice>
    );
  }

  return (
    <>
      <PageHeader
        title="Utilizadores e permissões"
        description="Cada pessoa tem a sua conta. Desactivar uma conta corta o acesso de imediato e mantém o histórico das operações. A atribuição do perfil de farmacêutico responsável é confirmada pela farmácia; a aplicação não certifica habilitações."
        actions={
          <Button
            onClick={() => setInviting(true)}
            disabled={!online}
            icon={<Icon name="plus" className="size-4" />}
          >
            Convidar funcionário
          </Button>
        }
      />
      {updateRole.isError && (
        <Notice tone="danger" className="mb-4">
          {toUserMessage(updateRole.error)}
        </Notice>
      )}
      <Card>
        {members.isPending ? (
          <LoadingState />
        ) : members.isError ? (
          <ErrorState message={toUserMessage(members.error)} onRetry={() => void members.refetch()} />
        ) : members.data.length ? (
          <DataTable
            rows={members.data}
            rowKey={(m) => m.member_id}
            rowClassName={(m) => (m.is_active ? undefined : 'opacity-60')}
            columns={[
              {
                header: 'Nome',
                cell: (m) => (
                  <div>
                    <p className="font-medium">
                      {m.display_name ?? '—'} {m.user_id === userId && <Badge tone="brand">Você</Badge>}
                    </p>
                    <p className="text-xs text-muted">{m.email}</p>
                  </div>
                ),
              },
              {
                header: 'Perfil',
                cell: (m) =>
                  m.user_id === userId ? (
                    ROLE_LABELS[m.role]
                  ) : (
                    <Select
                      aria-label={`Perfil de ${m.display_name ?? 'utilizador'}`}
                      className="h-9 min-w-52"
                      value={m.role}
                      disabled={!online || updateRole.isPending || !m.is_active}
                      onChange={(e) =>
                        updateRole.mutate(
                          { p_member_id: m.member_id, p_role: e.target.value, p_is_active: null },
                          { onSuccess: () => notify('Perfil actualizado.') },
                        )
                      }
                    >
                      {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  ),
              },
              {
                header: 'Estado',
                cell: (m) =>
                  m.is_active ? <Badge tone="success">Activo</Badge> : <Badge>Desactivado</Badge>,
              },
              { header: 'Último acesso', cell: (m) => formatDateTime(m.last_sign_in_at), hideOnMobile: true },
              {
                header: 'Acções',
                cell: (m) =>
                  m.user_id !== userId && (
                    <Button size="sm" variant="ghost" onClick={() => setToggling(m)} disabled={!online}>
                      {m.is_active ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  ),
              },
            ]}
          />
        ) : (
          <EmptyState title="Sem membros" />
        )}
      </Card>

      <Card className="mt-5 px-5 py-4">
        <h2 className="text-sm font-semibold">Perfis</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">
          {(Object.keys(ROLE_HELP) as MemberRole[]).map((r) => (
            <li key={r}>
              <strong className="text-ink">{ROLE_LABELS[r]}:</strong> {ROLE_HELP[r]}
            </li>
          ))}
        </ul>
      </Card>

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
      <ConfirmDialog
        open={!!toggling}
        title={toggling?.is_active ? 'Desactivar conta' : 'Reactivar conta'}
        confirmLabel={toggling?.is_active ? 'Desactivar' : 'Reactivar'}
        tone={toggling?.is_active ? 'danger' : 'primary'}
        loading={teamAdmin.isPending}
        onCancel={() => {
          setToggling(null);
          teamAdmin.reset();
        }}
        onConfirm={() =>
          toggling &&
          teamAdmin.mutate(
            { action: 'set_active', memberId: toggling.member_id, isActive: !toggling.is_active },
            {
              onSuccess: () => {
                notify(toggling.is_active ? 'Conta desactivada.' : 'Conta reactivada.');
                setToggling(null);
              },
            },
          )
        }
      >
        {toggling?.is_active ? (
          <p>
            {toggling.display_name ?? 'Este utilizador'} deixa imediatamente de aceder aos dados desta
            farmácia. Os movimentos que registou mantêm-se no histórico.
          </p>
        ) : (
          <p>{toggling?.display_name ?? 'Este utilizador'} volta a ter acesso com o perfil actual.</p>
        )}
        {teamAdmin.isError && <Notice tone="danger">{toUserMessage(teamAdmin.error)}</Notice>}
      </ConfirmDialog>
    </>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const { notify } = useToast();
  const teamAdmin = useTeamAdmin();
  const form = useForm<z.input<typeof inviteSchema>, unknown, z.output<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { display_name: '', email: '', role: 'stock_operator' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((v) =>
    teamAdmin.mutate(
      { action: 'invite', email: v.email, displayName: v.display_name, role: v.role },
      {
        onSuccess: () => {
          notify('Convite enviado por email.');
          onClose();
        },
      },
    ),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Convidar funcionário"
      description="O funcionário recebe um email para definir a sua palavra-passe. Contas partilhadas não são permitidas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="invite-form" loading={teamAdmin.isPending}>
            Enviar convite
          </Button>
        </>
      }
    >
      <form id="invite-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <Field label="Nome" required error={errors.display_name?.message}>
          {(p) => <Input {...p} autoFocus {...form.register('display_name')} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(p) => <Input {...p} type="email" {...form.register('email')} />}
        </Field>
        <Field label="Perfil" required hint={ROLE_HELP[form.watch('role')]} error={errors.role?.message}>
          {(p) => (
            <Select {...p} {...form.register('role')}>
              {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {teamAdmin.isError && <Notice tone="danger">{toUserMessage(teamAdmin.error)}</Notice>}
      </form>
    </Dialog>
  );
}
