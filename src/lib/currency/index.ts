const kzFormatter = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valores internos opcionais (custo/preço de referência). Nunca representam documentos fiscais. */
export function formatKz(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${kzFormatter.format(n)} Kz`;
}
