import type { AuditLog } from '@/types/database';
import { formatQuantity } from '@/lib/stock';

const ENTITY: Record<string, string> = {
  products: 'Produto',
  suppliers: 'Fornecedor',
  stock_batches: 'Lote',
  pharmacy_members: 'Membro da equipa',
  pharmacies: 'Farmácia',
  stock_counts: 'Contagem',
  stock_movements: 'Movimento',
};

const FIELD: Record<string, string> = {
  name: 'nome',
  minimum_stock: 'stock mínimo',
  is_active: 'activo',
  unit_name: 'unidade',
  barcode: 'código de barras',
  internal_code: 'código interno',
  status: 'estado',
  lot_number: 'n.º de lote',
  expiry_date: 'validade',
  reference_sale_price: 'preço de referência',
  purchase_unit_cost: 'custo unitário',
  supplier_id: 'fornecedor',
  role: 'perfil',
  timezone: 'fuso horário',
  currency: 'moeda',
  expiry_alert_days: 'janelas de alerta',
  active_ingredient: 'princípio activo',
  strength: 'dosagem',
  presentation: 'apresentação',
  dosage_form: 'forma farmacêutica',
  category: 'categoria',
  notes: 'observações',
  brand: 'marca',
  phone: 'telefone',
  email: 'email',
  address: 'morada',
};

function show(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** Texto legível de um registo de auditoria (sem dados sensíveis: o registo só guarda campos operacionais). */
export function describeAudit(log: AuditLog & { actor?: { display_name: string | null } | null }): string {
  const who = log.actor?.display_name ?? (log.actor_user_id ? 'Utilizador' : 'Sistema');
  const entity = ENTITY[log.entity_type] ?? log.entity_type;
  const m = log.metadata as {
    changed?: string[];
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    difference?: number;
    adjusted_batches?: number;
  };
  switch (log.action) {
    case 'insert':
      return `${who} criou: ${entity}.`;
    case 'update': {
      const details = (m.changed ?? []).map((f) =>
        m.after && f in m.after
          ? `${FIELD[f] ?? f}: ${show(m.before?.[f])} → ${show(m.after[f])}`
          : (FIELD[f] ?? f),
      );
      return `${who} alterou ${entity.toLowerCase()} (${details.join('; ')}).`;
    }
    case 'stock_adjustment':
      return `${who} ajustou a quantidade do lote (diferença ${formatQuantity(m.difference ?? 0)}).`;
    case 'movement_reversed':
      return `${who} corrigiu um movimento por movimento inverso.`;
    case 'stock_count_submitted':
      return `${who} enviou a contagem para revisão.`;
    case 'stock_count_approved':
      return `${who} aprovou a contagem (${m.adjusted_batches ?? 0} lotes ajustados).`;
    case 'stock_count_cancelled':
      return `${who} cancelou a contagem.`;
    case 'member_invited':
      return `${who} convidou um funcionário.`;
    default:
      return `${who}: ${log.action} (${entity}).`;
  }
}
