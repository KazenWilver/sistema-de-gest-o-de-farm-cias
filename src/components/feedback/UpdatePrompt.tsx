import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui';

/** Avisa quando existe uma nova versão da aplicação (o service worker só guarda ficheiros estáticos). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg"
    >
      <p className="flex-1">Há uma nova versão do FarmaStock.</p>
      <Button size="sm" variant="secondary" onClick={() => setNeedRefresh(false)}>
        Depois
      </Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </Button>
    </div>
  );
}
