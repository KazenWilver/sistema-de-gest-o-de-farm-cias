import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
} from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useBackupRuns } from '@/features/inventory/api';
import { can } from '@/lib/permissions';
import { formatDateTime } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';

function size(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Estado técnico apenas. Sem chaves, segredos, descarga ou restauro (procedimento técnico fora da aplicação). */
export function SecurityPage() {
  const { role } = usePharmacy();
  const runs = useBackupRuns();

  if (!can(role, 'security.read')) {
    return (
      <Notice tone="warning" title="Sem permissão">
        Esta página é só para a administradora.
      </Notice>
    );
  }

  const lastSuccess = runs.data?.find((r) => r.status === 'success');

  return (
    <>
      <PageHeader
        title="Segurança e cópias de segurança"
        description="Estado técnico das cópias de segurança. A descarga e o restauro não são feitos pela aplicação: são um procedimento técnico autenticado, executado por um administrador autorizado."
      />
      <div className="space-y-5">
        <Notice
          tone={lastSuccess ? 'info' : 'warning'}
          title={lastSuccess ? 'Última cópia externa válida' : 'Ainda não há cópias externas registadas'}
        >
          {lastSuccess
            ? `${formatDateTime(lastSuccess.finished_at ?? lastSuccess.started_at)} · ${size(lastSuccess.file_size_bytes)}`
            : 'O envio de cópias com dados reais para armazenamento externo só é activado depois da validação jurídica das transferências internacionais. O fornecedor da base de dados mantém cópias próprias conforme o plano contratado.'}
        </Notice>
        <Card>
          <CardHeader title="Histórico de execuções" />
          {runs.isPending ? (
            <LoadingState />
          ) : runs.isError ? (
            <ErrorState message={toUserMessage(runs.error)} />
          ) : runs.data.length ? (
            <DataTable
              rows={runs.data}
              rowKey={(r) => r.id}
              columns={[
                { header: 'Início', cell: (r) => formatDateTime(r.started_at) },
                {
                  header: 'Estado',
                  cell: (r) =>
                    r.status === 'success' ? (
                      <Badge tone="success">Concluída</Badge>
                    ) : r.status === 'failed' ? (
                      <Badge tone="danger">Falhou</Badge>
                    ) : (
                      <Badge tone="info">Em curso</Badge>
                    ),
                },
                { header: 'Tamanho', align: 'right', cell: (r) => size(r.file_size_bytes) },
                { header: 'Destino', cell: (r) => r.destination ?? '—', hideOnMobile: true },
                {
                  header: 'Verificação SHA-256',
                  cell: (r) =>
                    r.sha256_checksum ? (
                      <span className="font-mono text-xs">{r.sha256_checksum.slice(0, 16)}…</span>
                    ) : (
                      '—'
                    ),
                  hideOnMobile: true,
                },
                { header: 'Erro', cell: (r) => r.error_summary ?? '—', hideOnMobile: true },
              ]}
            />
          ) : (
            <EmptyState title="Sem execuções registadas" />
          )}
        </Card>
        <Card>
          <CardHeader title="Boas práticas da conta" />
          <ul className="list-disc space-y-1 px-9 py-4 text-sm text-ink-soft">
            <li>Cada funcionário tem a sua conta; nunca partilhe palavras-passe.</li>
            <li>Desactive de imediato as contas de quem deixa de trabalhar na farmácia.</li>
            <li>
              Active a autenticação em dois passos (MFA) para a conta administradora assim que estiver
              disponível.
            </li>
            <li>Comunique ao fornecedor técnico qualquer suspeita de acesso indevido.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
