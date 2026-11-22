import { daysBetween } from '@/lib/dates';
import type { MovementType } from '@/types/database';

export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired';

export interface ExpiryInfo {
  state: ExpiryState;
  days: number | null;
  /** Menor janela de alerta em que a data cai (ex.: 30, 60, 90). */
  window: number | null;
}

/** Estado de validade: válido, próximo (dentro de uma janela de alerta) ou expirado. */
export function expiryInfo(
  expiry: string | null,
  today: string,
  windows: number[] = [90, 60, 30],
): ExpiryInfo {
  if (!expiry) return { state: 'none', days: null, window: null };
  const days = daysBetween(today, expiry);
  if (days < 0) return { state: 'expired', days, window: null };
  const sorted = [...windows].sort((a, b) => a - b);
  const window = sorted.find((w) => days <= w) ?? null;
  return { state: window === null ? 'ok' : 'soon', days, window };
}

export type StockState = 'out' | 'low' | 'ok';

/** Stock baixo quando há stock mínimo definido e a quantidade disponível não o ultrapassa. */
export function stockState(available: number, minimum: number): StockState {
  if (available <= 0) return 'out';
  if (minimum > 0 && available <= minimum) return 'low';
  return 'ok';
}

const quantityFormatter = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3 });

export function formatQuantity(value: number | string | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return unit ? `${quantityFormatter.format(n)} ${unit}` : quantityFormatter.format(n);
}

/** Soma quantidades por unidade de controlo: caixas, frascos e unidades nunca se somam entre si. */
export function totalsByUnit(
  items: { unit_name: string; available_quantity: number | string }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    const unit = item.unit_name.trim().toLowerCase();
    totals.set(unit, (totals.get(unit) ?? 0) + Number(item.available_quantity));
  }
  return totals;
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  receipt: 'Entrada',
  issue: 'Saída (registada no sistema externo)',
  adjustment_in: 'Ajuste positivo',
  adjustment_out: 'Ajuste negativo',
  return_to_supplier: 'Devolução ao fornecedor',
  internal_transfer_in: 'Transferência interna (entrada)',
  internal_transfer_out: 'Transferência interna (saída)',
  expired_disposal: 'Eliminação por validade',
  damage: 'Quebra ou dano',
};

export const MOVEMENT_SHORT_LABELS: Record<MovementType, string> = {
  receipt: 'Entrada',
  issue: 'Saída',
  adjustment_in: 'Ajuste +',
  adjustment_out: 'Ajuste −',
  return_to_supplier: 'Devolução',
  internal_transfer_in: 'Transf. entrada',
  internal_transfer_out: 'Transf. saída',
  expired_disposal: 'Validade',
  damage: 'Quebra/dano',
};

export const INCREASING_MOVEMENTS: MovementType[] = ['receipt', 'adjustment_in', 'internal_transfer_in'];

export function movementSign(type: MovementType): 1 | -1 {
  return INCREASING_MOVEMENTS.includes(type) ? 1 : -1;
}

/** Tipos de saída disponíveis no formulário. Os normais exigem lote válido e não bloqueado. */
export const ISSUE_TYPES = [
  {
    value: 'issue',
    label: 'Saída registada no sistema externo da farmácia',
    normal: true,
    reasonRequired: false,
  },
  { value: 'internal_transfer_out', label: 'Transferência interna', normal: true, reasonRequired: false },
  { value: 'damage', label: 'Quebra ou dano', normal: false, reasonRequired: true },
  { value: 'return_to_supplier', label: 'Devolução ao fornecedor', normal: false, reasonRequired: true },
  { value: 'expired_disposal', label: 'Eliminação por validade', normal: false, reasonRequired: true },
] as const satisfies readonly {
  value: MovementType;
  label: string;
  normal: boolean;
  reasonRequired: boolean;
}[];

export type IssueType = (typeof ISSUE_TYPES)[number]['value'];

/** Ordena lotes pelo princípio FEFO (primeiro a expirar, primeiro a sair). Sem validade vai para o fim. */
export function sortFefo<T extends { expiry_date: string | null; received_at?: string }>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    if (a.expiry_date === b.expiry_date) return (a.received_at ?? '').localeCompare(b.received_at ?? '');
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });
}
