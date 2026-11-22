import { Badge } from '@/components/ui';
import { todayIso } from '@/lib/dates';
import { expiryInfo, MOVEMENT_SHORT_LABELS, movementSign } from '@/lib/stock';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import type { EffectiveBatchStatus, MovementType } from '@/types/database';

/** Dia actual e janelas de alerta da farmácia. */
export function useExpiryContext() {
  const { pharmacy } = usePharmacy();
  const windows = pharmacy.expiry_alert_days?.length ? pharmacy.expiry_alert_days : [90, 60, 30];
  return { today: todayIso(), windows, maxWindow: Math.max(...windows) };
}

export function StockStateBadge({ state }: { state: 'out' | 'low' | 'ok' }) {
  if (state === 'out') return <Badge tone="danger">Esgotado</Badge>;
  if (state === 'low') return <Badge tone="warning">Stock baixo</Badge>;
  return <Badge tone="success">Em stock</Badge>;
}

export function ExpiryBadge({ date }: { date: string | null }) {
  const { today, windows } = useExpiryContext();
  const info = expiryInfo(date, today, windows);
  if (info.state === 'none') return <Badge>Sem validade</Badge>;
  if (info.state === 'expired') return <Badge tone="danger">Expirado há {Math.abs(info.days!)} d</Badge>;
  if (info.state === 'soon') {
    return (
      <Badge tone={info.window! <= 30 ? 'danger' : 'warning'}>
        {info.days === 0 ? 'Expira hoje' : `Expira em ${info.days} d`}
      </Badge>
    );
  }
  return null;
}

export function BatchStatusBadge({ status }: { status: EffectiveBatchStatus }) {
  switch (status) {
    case 'blocked':
      return <Badge tone="danger">Bloqueado</Badge>;
    case 'expired':
      return <Badge tone="danger">Expirado</Badge>;
    case 'depleted':
      return <Badge>Esgotado</Badge>;
    default:
      return <Badge tone="success">Disponível</Badge>;
  }
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const tone =
    movementSign(type) > 0
      ? 'brand'
      : type.startsWith('adjustment') || type === 'issue'
        ? 'neutral'
        : 'warning';
  return (
    <Badge tone={type === 'adjustment_in' || type === 'adjustment_out' ? 'info' : tone}>
      {MOVEMENT_SHORT_LABELS[type]}
    </Badge>
  );
}
