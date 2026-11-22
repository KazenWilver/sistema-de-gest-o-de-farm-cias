interface ErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/**
 * Converte erros técnicos em mensagens para o utilizador, sem expor detalhes internos.
 * As mensagens das funções da base de dados (código P0001) já são escritas para o utilizador.
 */
export function toUserMessage(error: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sem ligação à Internet. A operação não foi registada. Tente novamente quando a ligação voltar.';
  }
  const e = (error ?? {}) as ErrorLike;
  switch (e.code) {
    case 'P0001':
      return e.message ?? 'Não foi possível concluir a operação.';
    case '42501':
      return 'Não tem permissão para esta operação. Se acha que devia ter, fale com a administradora da farmácia.';
    case '28000':
    case 'PGRST301':
      return 'A sua sessão terminou. Inicie sessão novamente.';
    case '23505':
      return 'Já existe um registo com estes dados (por exemplo, o mesmo código interno ou código de barras).';
    case '23514':
      return 'Há valores fora dos limites permitidos. Verifique os campos e tente novamente.';
    case '23503':
      return 'Este registo está ligado a outros dados e não pode ser alterado desta forma.';
  }
  if (e.message === 'Invalid login credentials') return 'Email ou palavra-passe incorrectos.';
  if (e.message?.toLowerCase().includes('failed to fetch')) {
    return 'Não foi possível contactar o servidor. Verifique a ligação à Internet e tente novamente.';
  }
  if (e.status === 429) return 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.';
  return 'Ocorreu um erro inesperado. Tente novamente. Se o problema continuar, contacte o suporte.';
}
