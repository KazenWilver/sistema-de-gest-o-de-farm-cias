import type { MemberRole } from '@/types/database';

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Administradora',
  manager: 'Farmacêutico responsável / Gestor',
  stock_operator: 'Funcionário de stock',
  viewer: 'Consulta',
};

export type Permission =
  | 'stock.move' // entradas, saídas, contagens
  | 'stock.adjust' // ajustes, correcções, bloquear lotes, aprovar contagens
  | 'catalog.manage' // produtos e fornecedores
  | 'audit.read'
  | 'team.manage'
  | 'settings.manage'
  | 'security.read';

const MATRIX: Record<Permission, MemberRole[]> = {
  'stock.move': ['owner', 'manager', 'stock_operator'],
  'stock.adjust': ['owner', 'manager'],
  'catalog.manage': ['owner', 'manager'],
  'audit.read': ['owner', 'manager'],
  'team.manage': ['owner'],
  'settings.manage': ['owner'],
  'security.read': ['owner'],
};

/**
 * Permissões na interface (só para mostrar/esconder acções).
 * A autoridade é sempre a base de dados (RLS + funções RPC).
 */
export function can(role: MemberRole | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[permission].includes(role);
}
