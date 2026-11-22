import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="alert"
      className="border-b border-warning-600/30 bg-warning-50 px-4 py-2.5 text-sm text-warning-700 sm:px-6"
    >
      <strong className="font-semibold">
        Sem ligação à Internet. As alterações ao stock estão temporariamente indisponíveis.
      </strong>{' '}
      Os dados no ecrã podem não estar actualizados.
    </div>
  );
}
