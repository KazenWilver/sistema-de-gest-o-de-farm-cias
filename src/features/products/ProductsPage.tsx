import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/components/ui';
import { DataTable } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icon';
import { Input, Select } from '@/components/forms/Field';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useBatches, useProductStock, useSuppliers } from '@/features/inventory/api';
import { ExpiryBadge, StockStateBadge, useExpiryContext } from '@/features/inventory/badges';
import { can } from '@/lib/permissions';
import { formatDate, todayIso } from '@/lib/dates';
import { formatQuantity } from '@/lib/stock';
import { downloadCsv, toCsv } from '@/lib/csv';
import { toUserMessage } from '@/lib/errors';
import type { ProductStock } from '@/types/database';

type StateFilter = '' | 'low' | 'out' | 'expiring' | 'unusable';

function normalize(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function ProductsPage() {
  const { role } = usePharmacy();
  const { maxWindow } = useExpiryContext();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const state = (params.get('estado') ?? '') as StateFilter;
  const category = params.get('categoria') ?? '';
  const supplier = params.get('fornecedor') ?? '';
  const showInactive = params.get('inactivos') === '1';

  const products = useProductStock();
  const batches = useBatches({ withStockOnly: true });
  const suppliers = useSuppliers();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const categories = useMemo(
    () => [...new Set((products.data ?? []).map((p) => p.category).filter(Boolean) as string[])].sort(),
    [products.data],
  );

  const flagged = useMemo(() => {
    const expiring = new Set<string>();
    const unusable = new Set<string>();
    for (const b of batches.data ?? []) {
      if (b.effective_status === 'expired' || b.effective_status === 'blocked') unusable.add(b.product_id);
      else if (b.days_to_expiry !== null && b.days_to_expiry <= maxWindow) expiring.add(b.product_id);
    }
    return { expiring, unusable };
  }, [batches.data, maxWindow]);

  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return (products.data ?? []).filter((p) => {
      if (!showInactive && !p.is_active) return false;
      if (state === 'low' && p.stock_state !== 'low') return false;
      if (state === 'out' && p.stock_state !== 'out') return false;
      if (state === 'expiring' && !flagged.expiring.has(p.id)) return false;
      if (state === 'unusable' && !flagged.unusable.has(p.id)) return false;
      if (category && p.category !== category) return false;
      if (supplier && !p.supplier_ids.includes(supplier)) return false;
      if (!q) return true;
      return [
        p.name,
        p.active_ingredient,
        p.strength,
        p.dosage_form,
        p.presentation,
        p.internal_code,
        p.barcode,
        p.lot_numbers,
        p.brand,
      ].some((v) => normalize(v).includes(q));
    });
  }, [products.data, query, state, category, supplier, showInactive, flagged]);

  const exportCsv = () => {
    const csv = toCsv<ProductStock>(rows, [
      { header: 'Produto', value: (p) => p.name },
      { header: 'Princípio activo', value: (p) => p.active_ingredient },
      { header: 'Dosagem', value: (p) => p.strength },
      { header: 'Forma farmacêutica', value: (p) => p.dosage_form },
      { header: 'Apresentação', value: (p) => p.presentation },
      { header: 'Unidade', value: (p) => p.unit_name },
      { header: 'Código interno', value: (p) => p.internal_code },
      { header: 'Código de barras', value: (p) => p.barcode },
      { header: 'Categoria', value: (p) => p.category },
      { header: 'Stock disponível', value: (p) => Number(p.available_quantity) },
      { header: 'Stock não utilizável (expirado/bloqueado)', value: (p) => Number(p.unusable_quantity) },
      { header: 'Stock mínimo', value: (p) => Number(p.minimum_stock) },
      {
        header: 'Estado',
        value: (p) => ({ out: 'Esgotado', low: 'Stock baixo', ok: 'Em stock' })[p.stock_state],
      },
      { header: 'Próxima validade', value: (p) => formatDate(p.next_expiry_date) },
      { header: 'Activo', value: (p) => (p.is_active ? 'Sim' : 'Não') },
    ]);
    downloadCsv(`inventario-${todayIso()}.csv`, csv);
  };

  return (
    <>
      <PageHeader
        title="Medicamentos e produtos"
        description="Stock calculado a partir dos lotes utilizáveis (não expirados nem bloqueados)."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={!rows.length}
              icon={<Icon name="download" className="size-4" />}
            >
              Exportar CSV
            </Button>
            {can(role, 'catalog.manage') && (
              <ButtonLink to="/produtos/novo">
                <Icon name="plus" className="size-4" /> Novo produto
              </ButtonLink>
            )}
          </>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-3 sm:px-5 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
          <label className="relative block">
            <span className="sr-only">Pesquisar</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              className="pl-9"
              placeholder="Nome, princípio activo, dosagem, código, código de barras ou lote"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setParam('q', e.target.value);
              }}
            />
          </label>
          <Select
            aria-label="Filtrar por estado"
            value={state}
            onChange={(e) => setParam('estado', e.target.value)}
          >
            <option value="">Todos os estados</option>
            <option value="low">Stock baixo</option>
            <option value="out">Esgotado</option>
            <option value="expiring">Próximo da validade</option>
            <option value="unusable">Expirado / bloqueado</option>
          </Select>
          <Select
            aria-label="Filtrar por categoria"
            value={category}
            onChange={(e) => setParam('categoria', e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por fornecedor"
            value={supplier}
            onChange={(e) => setParam('fornecedor', e.target.value)}
          >
            <option value="">Todos os fornecedores</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-ink-soft md:col-span-4">
            <input
              type="checkbox"
              className="size-4 accent-brand-700"
              checked={showInactive}
              onChange={(e) => setParam('inactivos', e.target.checked ? '1' : '')}
            />
            Mostrar produtos inactivos
          </label>
        </div>

        {products.isPending ? (
          <LoadingState />
        ) : products.isError ? (
          <ErrorState message={toUserMessage(products.error)} onRetry={() => void products.refetch()} />
        ) : !rows.length ? (
          products.data.length ? (
            <EmptyState title="Nenhum produto corresponde à pesquisa">
              Altere os termos ou os filtros.
            </EmptyState>
          ) : (
            <EmptyState
              title="Ainda não há produtos"
              action={
                can(role, 'catalog.manage') && (
                  <ButtonLink to="/produtos/novo">Registar o primeiro produto</ButtonLink>
                )
              }
            >
              Registe os medicamentos e produtos de saúde que a farmácia quer controlar.
            </EmptyState>
          )
        ) : (
          <>
            <DataTable
              rows={rows}
              rowKey={(p) => p.id}
              caption="Lista de produtos"
              columns={[
                {
                  header: 'Produto',
                  cell: (p) => (
                    <div className="min-w-48">
                      <Link to={`/produtos/${p.id}`} className="font-medium text-ink hover:underline">
                        {p.name}
                      </Link>
                      {!p.is_active && (
                        <span className="ml-2">
                          <Badge>Inactivo</Badge>
                        </span>
                      )}
                      <p className="text-xs text-muted">
                        {[p.internal_code, p.category].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ),
                },
                { header: 'Princípio activo', cell: (p) => p.active_ingredient ?? '—', hideOnMobile: true },
                { header: 'Dosagem', cell: (p) => p.strength ?? '—', hideOnMobile: true },
                { header: 'Apresentação', cell: (p) => p.presentation ?? '—', hideOnMobile: true },
                {
                  header: 'Disponível',
                  align: 'right',
                  cell: (p) => (
                    <span className="font-semibold">{formatQuantity(p.available_quantity, p.unit_name)}</span>
                  ),
                },
                {
                  header: 'Mínimo',
                  align: 'right',
                  cell: (p) => formatQuantity(p.minimum_stock),
                  hideOnMobile: true,
                },
                { header: 'Estado', cell: (p) => <StockStateBadge state={p.stock_state} /> },
                {
                  header: 'Próxima validade',
                  cell: (p) =>
                    p.next_expiry_date ? (
                      <div className="space-y-0.5">
                        <p className="tabular">{formatDate(p.next_expiry_date)}</p>
                        <ExpiryBadge date={p.next_expiry_date} />
                      </div>
                    ) : (
                      '—'
                    ),
                  hideOnMobile: true,
                },
                {
                  header: 'Acções',
                  cell: (p) => (
                    <div className="flex gap-1">
                      <ButtonLink to={`/produtos/${p.id}`} size="sm" variant="ghost">
                        Abrir
                      </ButtonLink>
                      {can(role, 'stock.move') && p.is_active && (
                        <ButtonLink to={`/movimentos/entrada?produto=${p.id}`} size="sm" variant="ghost">
                          Entrada
                        </ButtonLink>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted sm:px-5">
              {rows.length} de {products.data.length} produtos
            </p>
          </>
        )}
      </Card>
    </>
  );
}
