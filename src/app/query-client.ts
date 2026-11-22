import { QueryClient } from '@tanstack/react-query';

// Cache só em memória (nunca persistida): o inventário não fica guardado no dispositivo.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (count, error) => {
        const code = (error as { code?: string }).code;
        if (code === '42501' || code === 'PGRST301' || code === '28000') return false;
        return count < 2;
      },
    },
    mutations: {
      // Escritas exigem confirmação do servidor: nunca ficam em fila offline.
      networkMode: 'always',
      retry: false,
    },
  },
});
