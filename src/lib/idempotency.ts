import { useCallback, useState } from 'react';

/**
 * Chave de idempotência por operação: criada quando o formulário abre, reutilizada em
 * repetições (duplo clique, reenvio após falha de rede) e renovada só depois do sucesso.
 */
export function useIdempotencyKey(): [string, () => void] {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => setKey(crypto.randomUUID()), []);
  return [key, renew];
}
