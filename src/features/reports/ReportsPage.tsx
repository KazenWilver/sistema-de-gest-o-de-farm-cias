import { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
} from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Field, Input } from '@/components/forms/Field';
import { Icon } from '@/components/ui/Icon';
import {
  useAllMovementsForExport,
  useBatches,
  useMovementSummary,
  useProductStock,
} from '@/features/inventory/api';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { addDays, formatDate, formatDateTime, todayIso } from '@/lib/dates';
import { formatQuantity, MOVEMENT_LABELS } from '@/lib/stock';
import { downloadCsv, toCsv } from '@/lib/csv';
import { toUserMessage } from '@/lib/errors';

const STATUS_LABEL = {
  active: 'Disponível',
  blocked: 'Bloqueado',
  expired: 'Expirado',
  depleted: 'Esgotado',
} as const;

export function ReportsPage() {
  const { pharmacy } = usePharmacy();
  const today = todayIso();
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const summary = useMovementSummary(from, to);
  const products = useProductStock();
  const batches = useBatches();
  const fetchMovements = useAllMovementsForExport();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const slug = pharmacy.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-');

  const exportInventory = () => {
    const rows = (products.data ?? []).filter((p) => p.is_active);
    downloadCsv(
      `${slug}-inventario-${today}.csv`,
      toCsv(rows, [
        { header: 'Produto', value: (p) => p.name },
        { header: 'Princípio activo', value: (p) => p.active_ingredient },
        { header: 'Dosagem', value: (p) => p.strength },
        { header: 'Apresentação', value: (p) => p.presentation },
        { header: 'Unidade', value: (p) => p.unit_name },
        { header: 'Código interno', value: (p) => p.internal_code },
        { header: 'Stock disponível', value: (p) => Number(p.available_quantity) },
        { header: 'Stock mínimo', value: (p) => Number(p.minimum_stock) },
        { header: 'Próxima validade', value: (p) => formatDate(p.next_expiry_date) },
      ]),
    );
  };

  const exportBatches = () => {
    downloadCsv(
      `${slug}-lotes-${today}.csv`,
      toCsv(batches.data ?? [], [
        { header: 'Produto', value: (b) => b.product_name },
        { header: 'Lote', value: (b) => b.lot_number },
        { header: 'Validade', value: (b) => formatDate(b.expiry_date) },
        { header: 'Dias até à validade', value: (b) => b.days_to_expiry },
        { header: 'Disponível', value: (b) => Number(b.available_quantity) },
        { header: 'Recebido', value: (b) => Number(b.received_quantity) },
        { header: 'Unidade', value: (b) => b.unit_name },
        { header: 'Estado', value: (b) => STATUS_LABEL[b.effective_status] },
        { header: 'Fornecedor', value: (b) => b.supplier_name },
        { header: 'Recebido em', value: (b) => formatDateTime(b.received_at) },
      ]),
    );
  };

  const exportMovements = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const rows = await fetchMovements(from, to);
      downloadCsv(
        `${slug}-movimentos-${from}-a-${to}.csv`,
        toCsv(rows, [
          { header: 'Data e hora (Luanda)', value: (m) => formatDateTime(m.created_at) },
          { header: 'Tipo', value: (m) => MOVEMENT_LABELS[m.movement_type] },
          { header: 'Produto', value: (m) => m.product_name },
          { header: 'Lote', value: (m) => m.lot_number },
          { header: 'Quantidade', value: (m) => Number(m.quantity) },
          { header: 'Antes', value: (m) => Number(m.quantity_before) },
          { header: 'Depois', value: (m) => Number(m.quantity_after) },
          { header: 'Unidade', value: (m) => m.unit_name },
          { header: 'Utilizador', value: (m) => m.created_by_name },
          { header: 'Motivo', value: (m) => m.reason },
          { header: 'Referência', value: (m) => m.reference },
          { header: 'Correcção de', value: (m) => m.reverses_movement_id },
        ]),
      );
    } catch (e) {
      setExportError(toUserMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Relatórios internos de inventário. As exportações respeitam as mesmas permissões e o mesmo isolamento das páginas."
      />
      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Exportar para CSV"
            description="Ficheiros separados por “;”, prontos a abrir numa folha de cálculo."
          />
          <div className="flex flex-wrap gap-2 px-4 py-4 sm:px-5">
            <Button
              variant="secondary"
              onClick={exportInventory}
              disabled={!products.data}
              icon={<Icon name="download" className="size-4" />}
            >
              Inventário actual
            </Button>
            <Button
              variant="secondary"
              onClick={exportBatches}
              disabled={!batches.data}
              icon={<Icon name="download" className="size-4" />}
            >
              Lotes e validades
            </Button>
            <Button
              variant="secondary"
              onClick={() => void exportMovements()}
              loading={exporting}
              icon={<Icon name="download" className="size-4" />}
            >
              Movimentos do período
            </Button>
          </div>
          {exportError && (
            <Notice tone="danger" className="mx-5 mb-4">
              {exportError}
            </Notice>
          )}
        </Card>

        <Card>
          <CardHeader title="Resumo de movimentos por período" />
          <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-2 sm:px-5 md:max-w-xl">
            <Field label="De">
              {(p) => (
                <Input {...p} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              )}
            </Field>
            <Field label="Até">
              {(p) => (
                <Input {...p} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              )}
            </Field>
          </div>
          {summary.isPending ? (
            <LoadingState />
          ) : summary.isError ? (
            <ErrorState message={toUserMessage(summary.error)} onRetry={() => void summary.refetch()} />
          ) : summary.data.length ? (
            <>
              <DataTable
                rows={summary.data}
                rowKey={(r) => r.movement_type}
                columns={[
                  { header: 'Tipo de movimento', cell: (r) => MOVEMENT_LABELS[r.movement_type] },
                  { header: 'N.º de movimentos', align: 'right', cell: (r) => r.movement_count },
                  { header: 'Produtos diferentes', align: 'right', cell: (r) => r.product_count },
                  {
                    header: 'Quantidade total',
                    align: 'right',
                    cell: (r) => formatQuantity(r.total_quantity),
                  },
                ]}
              />
              <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
                A quantidade total soma unidades de controlo diferentes (caixas, frascos…) e serve apenas como
                indicador de actividade.
              </p>
            </>
          ) : (
            <EmptyState title="Sem movimentos neste período" />
          )}
        </Card>
      </div>
    </>
  );
}
