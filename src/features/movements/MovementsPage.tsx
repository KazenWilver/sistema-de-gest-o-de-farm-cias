import { useState } from 'react';
import { ButtonLink, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { Field, Input, Select } from '@/components/forms/Field';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { useMovements } from '@/features/inventory/api';
import { can } from '@/lib/permissions';
import { addDays, todayIso } from '@/lib/dates';
import { MOVEMENT_LABELS } from '@/lib/stock';
import { toUserMessage } from '@/lib/errors';
import type { MovementType } from '@/types/database';
import { MovementTable } from './MovementTable';

export function MovementsPage() {
  const { role } = usePharmacy();
  const today = todayIso();
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [type, setType] = useState<MovementType | ''>('');
  const movements = useMovements({ from, to, type, limit: 500 });

  return (
    <>
      <PageHeader
        title="Movimentos"
        description="Histórico imutável de entradas, saídas e ajustes. Para corrigir um erro, registe uma correcção: o original mantém-se."
        actions={
          can(role, 'stock.move') && (
            <>
              <ButtonLink to="/movimentos/entrada">Registar entrada</ButtonLink>
              <ButtonLink to="/movimentos/saida" variant="secondary">
                Registar saída
              </ButtonLink>
            </>
          )
        }
      />
      <Card>
        <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-3 sm:px-5">
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
          <Field label="Tipo">
            {(p) => (
              <Select {...p} value={type} onChange={(e) => setType(e.target.value as MovementType | '')}>
                <option value="">Todos</option>
                {Object.entries(MOVEMENT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {movements.isPending ? (
          <LoadingState />
        ) : movements.isError ? (
          <ErrorState message={toUserMessage(movements.error)} onRetry={() => void movements.refetch()} />
        ) : movements.data.length ? (
          <>
            <MovementTable movements={movements.data} />
            {movements.data.length >= 500 && (
              <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
                A mostrar os 500 movimentos mais recentes. Reduza o período ou exporte em Relatórios.
              </p>
            )}
          </>
        ) : (
          <EmptyState title="Sem movimentos neste período" />
        )}
      </Card>
    </>
  );
}
