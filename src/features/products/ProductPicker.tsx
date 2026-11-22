import { useMemo, useState } from 'react';
import { Field, Input, Select } from '@/components/forms/Field';
import { useProductStock } from '@/features/inventory/api';
import { formatQuantity } from '@/lib/stock';
import type { ProductStock } from '@/types/database';

/** Escolha de produto com pesquisa (nome, princípio activo, código, código de barras). */
export function ProductPicker({
  value,
  onChange,
  error,
  onlyWithStock = false,
}: {
  value: string;
  onChange: (id: string, product: ProductStock | undefined) => void;
  error?: string;
  onlyWithStock?: boolean;
}) {
  const products = useProductStock();
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data ?? [])
      .filter((p) => p.is_active)
      .filter(
        (p) =>
          !onlyWithStock || Number(p.available_quantity) + Number(p.unusable_quantity) > 0 || p.id === value,
      )
      .filter(
        (p) =>
          !q ||
          p.id === value ||
          [p.name, p.active_ingredient, p.internal_code, p.barcode, p.strength].some((v) =>
            (v ?? '').toLowerCase().includes(q),
          ),
      )
      .slice(0, 300);
  }, [products.data, query, value, onlyWithStock]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Pesquisar produto" hint="Nome, princípio activo, código ou código de barras.">
        {(p) => (
          <Input
            {...p}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Leitor de código de barras: correspondência exacta selecciona logo o produto.
              const exact = products.data?.find((x) => x.barcode && x.barcode === e.target.value.trim());
              if (exact) onChange(exact.id, exact);
            }}
          />
        )}
      </Field>
      <Field label="Produto" required error={error}>
        {(p) => (
          <Select
            {...p}
            value={value}
            onChange={(e) =>
              onChange(
                e.target.value,
                products.data?.find((x) => x.id === e.target.value),
              )
            }
            disabled={products.isPending}
          >
            <option value="">{products.isPending ? 'A carregar…' : 'Seleccione o produto'}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.strength ? ` ${o.strength}` : ''}
                {o.presentation ? ` — ${o.presentation}` : ''} (
                {formatQuantity(o.available_quantity, o.unit_name)})
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}
