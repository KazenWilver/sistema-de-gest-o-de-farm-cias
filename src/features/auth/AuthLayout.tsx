import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-9" />
            <div>
              <p className="text-lg font-semibold leading-tight">FarmaStock</p>
              <p className="text-xs text-muted">Inventário interno da farmácia</p>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <h1 className="text-lg font-semibold">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted">
        Sistema interno de inventário — não emite facturas nem substitui o software fiscal da farmácia.
        <br />
        <Link to="/aviso-privacidade" className="underline hover:text-ink">
          Aviso de privacidade
        </Link>
        {' · '}
        <Link to="/termos" className="underline hover:text-ink">
          Termos de utilização
        </Link>
      </footer>
    </div>
  );
}
