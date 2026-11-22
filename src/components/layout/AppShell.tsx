import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePharmacy } from '@/features/pharmacy/PharmacyProvider';
import { can, ROLE_LABELS, type Permission } from '@/lib/permissions';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { UpdatePrompt } from '@/components/feedback/UpdatePrompt';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: 'overview' },
  { to: '/produtos', label: 'Medicamentos e produtos', icon: 'products' },
  { to: '/lotes', label: 'Lotes e stock', icon: 'batches' },
  { to: '/movimentos', label: 'Movimentos', icon: 'movements' },
  { to: '/contagens', label: 'Contagem de inventário', icon: 'counts' },
  { to: '/fornecedores', label: 'Fornecedores', icon: 'suppliers' },
  { to: '/alertas', label: 'Alertas', icon: 'alerts' },
  { to: '/relatorios', label: 'Relatórios', icon: 'reports' },
  { to: '/equipa', label: 'Utilizadores e permissões', icon: 'team', permission: 'team.manage' },
  { to: '/definicoes', label: 'Definições', icon: 'settings' },
  { to: '/seguranca', label: 'Segurança e cópias', icon: 'security', permission: 'security.read' },
];

export function AppShell() {
  const { pharmacy, role, memberships, selectPharmacy, displayName } = usePharmacy();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const items = NAV.filter((i) => !i.permission || can(role, i.permission));

  const nav = (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5 px-3 py-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-canvas hover:text-ink',
            )
          }
        >
          <Icon name={item.icon} className="size-[18px] shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-line px-4 py-4 text-xs text-muted">
      <p className="font-medium text-ink-soft">{displayName ?? 'Utilizador'}</p>
      <p>{ROLE_LABELS[role]}</p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-3 inline-flex items-center gap-2 rounded-md px-2 py-1 -ml-2 font-medium text-ink-soft hover:bg-canvas"
      >
        <Icon name="logout" className="size-4" /> Terminar sessão
      </button>
      <p className="mt-4 leading-relaxed">
        Sistema interno de inventário. Não substitui o software de facturação da farmácia.
      </p>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Saltar para o conteúdo
      </a>

      {/* Barra lateral (computador) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {sidebarFooter}
      </aside>

      {/* Menu móvel */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            className="absolute inset-0 bg-ink/40"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                className="rounded-md p-2 text-ink-soft hover:bg-canvas"
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {sidebarFooter}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="-ml-2 rounded-md p-2 text-ink-soft hover:bg-canvas lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Icon name="menu" />
          </button>
          <div className="min-w-0 flex-1">
            {memberships.length > 1 ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">Farmácia</span>
                <select
                  className="h-9 max-w-full truncate rounded-lg border border-line-strong bg-surface px-2 font-medium"
                  value={pharmacy.id}
                  onChange={(e) => selectPharmacy(e.target.value)}
                >
                  {memberships.map((m) => (
                    <option key={m.pharmacy_id} value={m.pharmacy_id}>
                      {m.pharmacies.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="truncate font-semibold text-ink">{pharmacy.name}</p>
            )}
          </div>
          <span className="hidden text-xs text-muted sm:inline">{ROLE_LABELS[role]}</span>
        </header>
        <OfflineBanner />
        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <UpdatePrompt />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2.5 px-5">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span className="text-[17px] font-semibold tracking-tight text-ink">FarmaStock</span>
      <span className="rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-700">
        Piloto
      </span>
    </div>
  );
}
