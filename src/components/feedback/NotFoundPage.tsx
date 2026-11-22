import { ButtonLink, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState title="Página não encontrada" action={<ButtonLink to="/">Ir para a visão geral</ButtonLink>}>
      O endereço pode estar errado ou a página foi removida.
    </EmptyState>
  );
}
