import { createBrowserRouter } from 'react-router';
import { AppGate } from './AppGate';
import { LoginPage, ResetRequestPage, SetPasswordPage } from '@/features/auth/pages';
import { LegalPage } from '@/features/legal/texts';
import { NotFoundPage } from '@/components/feedback/NotFoundPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

// Ecrãs carregados a pedido (divisão do bundle). Só ficheiros estáticos: nada de dados.
const page =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) =>
  async () => ({
    Component: (await load())[name] as React.ComponentType,
  });

export const router = createBrowserRouter([
  { path: '/entrar', element: <LoginPage /> },
  { path: '/recuperar-palavra-passe', element: <ResetRequestPage /> },
  { path: '/definir-palavra-passe', element: <SetPasswordPage /> },
  { path: '/aviso-privacidade', element: <LegalPage kind="privacy" /> },
  { path: '/termos', element: <LegalPage kind="terms" /> },
  {
    path: '/',
    element: <AppGate />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'produtos', lazy: page(() => import('@/features/products/ProductsPage'), 'ProductsPage') },
      {
        path: 'produtos/novo',
        lazy: page(() => import('@/features/products/ProductFormPage'), 'ProductFormPage'),
      },
      {
        path: 'produtos/:id',
        lazy: page(() => import('@/features/products/ProductDetailPage'), 'ProductDetailPage'),
      },
      {
        path: 'produtos/:id/editar',
        lazy: page(() => import('@/features/products/ProductFormPage'), 'ProductFormPage'),
      },
      { path: 'lotes', lazy: page(() => import('@/features/batches/BatchesPage'), 'BatchesPage') },
      { path: 'movimentos', lazy: page(() => import('@/features/movements/MovementsPage'), 'MovementsPage') },
      {
        path: 'movimentos/entrada',
        lazy: page(() => import('@/features/movements/ReceiptPage'), 'ReceiptPage'),
      },
      { path: 'movimentos/saida', lazy: page(() => import('@/features/movements/IssuePage'), 'IssuePage') },
      {
        path: 'contagens',
        lazy: page(() => import('@/features/stock-counts/StockCountsPage'), 'StockCountsPage'),
      },
      {
        path: 'contagens/:id',
        lazy: page(() => import('@/features/stock-counts/StockCountDetailPage'), 'StockCountDetailPage'),
      },
      {
        path: 'fornecedores',
        lazy: page(() => import('@/features/suppliers/SuppliersPage'), 'SuppliersPage'),
      },
      { path: 'alertas', lazy: page(() => import('@/features/alerts/AlertsPage'), 'AlertsPage') },
      { path: 'relatorios', lazy: page(() => import('@/features/reports/ReportsPage'), 'ReportsPage') },
      { path: 'equipa', lazy: page(() => import('@/features/team/TeamPage'), 'TeamPage') },
      { path: 'definicoes', lazy: page(() => import('@/features/settings/SettingsPage'), 'SettingsPage') },
      { path: 'seguranca', lazy: page(() => import('@/features/settings/SecurityPage'), 'SecurityPage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
