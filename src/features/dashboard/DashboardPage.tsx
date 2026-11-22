import { Link } from 'react-router';
import {
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useBatches, useMovements, useProductStock } from '@/features/inventory/api';
import {
  ExpiryBadge,
  MovementTypeBadge,
  StockStateBadge,
  useExpiryContext,
} from '@/features/inventory/badges';
import { can } from '@/lib/permissions';
import { formatDate, formatDateTime, addDays } from '@/lib/dates';
import { formatQuantity, movementSign, totalsByUnit } from '@/lib/stock';
import { toUserMessage } from '@/lib/errors';

export function DashboardPage() {
  const { role, pharmacy } = usePharmacy();
  const { maxWindow, today } = useExpiryContext();
  const products = useProductStock();
  const batches = useBatches({ withStockOnly: true });
  const movements = useMovements({ limit: 10 });
  const adjustments = useMovements({ from: addDays(today, -7), limit: 50 });

  if (products.isPending || batches.isPending) return <LoadingState />;
  if (products.isError)
    return <ErrorState message={toUserMessage(products.error)} onRetry={() => void products.refetch()} />;
  if (batches.isError)
    return <ErrorState message={toUserMessage(batches.error)} onRetry={() => void batches.refetch()} />;

  const active = products.data.filter((p) => p.is_active);
  const low = active.filter((p) => p.stock_state === 'low');
  const out = active.filter((p) => p.stock_state === 'out');
  const expiring = batches.data.filter(
    (b) => b.effective_status === 'active' && b.days_to_expiry !== null && b.days_to_expiry <= maxWindow,
  );
  const unusable = batches.data.filter(
    (b) => b.effective_status === 'expired' || b.effective_status === 'blocked',
  );
  const unitTotals = [
    ...totalsByUnit(
      active.map((p) => ({ unit_name: p.unit_name, available_quantity: p.available_quantity })),
    ),
  ]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const recentAdjustments = (adjustments.data ?? []).filter(
    (m) => m.movement_type === 'adjustment_in' || m.movement_type === 'adjustment_out',
  );
  const restock = [...out, ...low].slice(0, 8);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`O que precisa de atenção hoje, ${formatDate(today)}, em ${pharmacy.name}.`}
        actions={
          can(role, 'stock.move') && (
            <>
              <ButtonLink to="/movimentos/entrada">
                <Icon name="plus" className="size-4" /> Registar entrada
              </ButtonLink>
              <ButtonLink to="/movimentos/saida" variant="secondary">
                Registar saída
              </ButtonLink>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Produtos activos" value={active.length} to="/produtos" />
        <StatCard
          label="Stock baixo"
          value={low.length}
          tone={low.length ? 'warning' : 'neutral'}
          to="/alertas"
        />
        <StatCard
          label="Esgotados"
          value={out.length}
          tone={out.length ? 'danger' : 'neutral'}
          to="/alertas"
        />
        <StatCard
          label="Validade próxima"
          value={expiring.length}
          tone={expiring.length ? 'warning' : 'neutral'}
          hint={`lotes nos próximos ${maxWindow} dias`}
          to="/alertas"
        />
        <StatCard
          label="Expirados ou bloqueados"
          value={unusable.length}
          tone={unusable.length ? 'danger' : 'neutral'}
          hint="lotes com quantidade"
          to="/lotes"
        />
        <div className="col-span-2 rounded-xl border border-line bg-surface px-4 py-3.5 md:col-span-1">
          <p className="text-sm text-muted">Unidades disponíveis</p>
          {unitTotals.length ? (
            <ul className="mt-1 space-y-0.5 text-sm">
              {unitTotals.slice(0, 4).map(([unit, n]) => (
                <li key={unit} className="flex justify-between gap-2 tabular">
                  <span className="text-ink-soft">{unit}</span>
                  <span className="font-semibold">{formatQuantity(n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">Sem stock registado</p>
          )}
          <p className="mt-1 text-xs text-muted">Totais por unidade, sem somar unidades diferentes.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Repor stock" description="Produtos esgotados ou no stock mínimo." />
          {restock.length ? (
            <ul className="divide-y divide-line">
              {restock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <Link to={`/produtos/${p.id}`} className="min-w-0 truncate font-medium hover:underline">
                    {p.name} {p.strength && <span className="font-normal text-muted">{p.strength}</span>}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3 text-sm tabular">
                    <span className="text-muted">
                      {formatQuantity(p.available_quantity)} / mín. {formatQuantity(p.minimum_stock)}
                    </span>
                    <StockStateBadge state={p.stock_state} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nada para repor">
              Todos os produtos activos estão acima do stock mínimo.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Verificar validade"
            description={`Lotes com stock que expiram nos próximos ${maxWindow} dias ou já expiraram.`}
          />
          {[...unusable.filter((b) => b.effective_status === 'expired'), ...expiring].length ? (
            <ul className="divide-y divide-line">
              {[...unusable.filter((b) => b.effective_status === 'expired'), ...expiring]
                .slice(0, 8)
                .map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0">
                      <Link
                        to={`/produtos/${b.product_id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {b.product_name}
                      </Link>
                      <p className="text-xs text-muted">
                        Lote {b.lot_number} · validade {formatDate(b.expiry_date)} ·{' '}
                        {formatQuantity(b.available_quantity, b.unit_name)}
                      </p>
                    </div>
                    <ExpiryBadge date={b.expiry_date} />
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState title="Sem lotes a expirar">
              Nenhum lote com stock está dentro das janelas de alerta.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Rever ajustes recentes"
            description="Ajustes de inventário dos últimos 7 dias."
          />
          {recentAdjustments.length ? (
            <ul className="divide-y divide-line">
              {recentAdjustments.slice(0, 6).map((m) => (
                <li key={m.id} className="px-4 py-2.5 text-sm sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{m.product_name}</span>
                    <span className="shrink-0 tabular">
                      {movementSign(m.movement_type) > 0 ? '+' : '−'}
                      {formatQuantity(m.quantity, m.unit_name)}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {formatDateTime(m.created_at)} · {m.created_by_name ?? 'Utilizador'} · {m.reason}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sem ajustes recentes" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Últimos movimentos"
            actions={
              <ButtonLink to="/movimentos" variant="ghost" size="sm">
                Ver todos
              </ButtonLink>
            }
          />
          {movements.data?.length ? (
            <ul className="divide-y divide-line">
              {movements.data.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.product_name}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(m.created_at)} · {m.created_by_name ?? 'Utilizador'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 tabular">
                    <MovementTypeBadge type={m.movement_type} />
                    <span>
                      {movementSign(m.movement_type) > 0 ? '+' : '−'}
                      {formatQuantity(m.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Ainda não há movimentos" />
          )}
        </Card>
      </div>
    </>
  );
}
