# Arquitectura

## Visão geral

```text
Navegador (PWA instalável)
  React + TanStack Query (cache só em memória)
        |  HTTPS, JWT do utilizador (chave anon)
        v
Supabase
  ├── Auth (email + palavra-passe, convites, recuperação; MFA TOTP disponível)
  ├── PostgREST  -> tabelas/views com RLS (leitura) e funções RPC (escrita de stock)
  ├── Edge Function team-admin (convites e bloqueio de contas; única com service_role)
  └── Postgres (schemas public + private)
        |
        +-- backups cifrados (age) -> Cloudflare R2   [DESLIGADO até validação jurídica]
Cloudflare Pages: ficheiros estáticos do build (sem segredos)
GitHub Actions: CI; backup agendado desactivado por defeito
```

Não há backend próprio. A autoridade sobre permissões e quantidades é **a base de dados**: RLS para leituras, funções `SECURITY DEFINER` para escritas de stock. A interface só esconde acções que o perfil não pode fazer.

## Frontend (`src/`)

| Pasta                       | Responsabilidade                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                      | Router (ecrãs carregados a pedido), providers, QueryClient, `AppGate`                                                                                                  |
| `features/*`                | Um módulo por área: `auth`, `dashboard`, `products`, `batches`, `movements`, `stock-counts`, `suppliers`, `alerts`, `reports`, `team`, `settings`, `legal`, `pharmacy` |
| `features/inventory/api.ts` | Todas as chamadas ao Supabase (consultas e RPC)                                                                                                                        |
| `components/`               | UI partilhada (botões, tabelas, diálogos, formulários, avisos offline)                                                                                                 |
| `lib/`                      | Domínio puro e testado: datas (Africa/Luanda), stock/validade, moeda (AOA), permissões, CSV, validação Zod, idempotência                                               |
| `types/database.ts`         | Tipos das tabelas, views e RPC                                                                                                                                         |

Fluxo de uma operação de stock: o formulário abre e gera uma `idempotency_key` → validação Zod → diálogo de confirmação → RPC → invalidação das consultas relacionadas → nova chave só após sucesso. Se a rede falhar e o utilizador repetir, a mesma chave devolve o movimento já registado.

### Multi-farmácia

Um utilizador pode pertencer a várias farmácias (`pharmacy_members`). O `PharmacyProvider` escolhe a farmácia activa; todas as consultas filtram por `pharmacy_id` e o RLS garante o isolamento mesmo que o filtro falhe.

### PWA e modo offline

- O service worker faz precache **só** dos ficheiros estáticos do build (`runtimeCaching: []`). Nenhuma resposta da API é guardada em Cache Storage.
- A cache do TanStack Query vive em memória e é limpa ao terminar sessão.
- Sem ligação: aparece um aviso permanente e todos os botões de escrita ficam desactivados. Não há escrita offline nem fila de sincronização.
- Actualizações do service worker são propostas ao utilizador (`registerType: 'prompt'`).

## Base de dados

- `public`: tabelas da aplicação e views (`batch_overview`, `product_stock`, `movement_overview`, `movement_summary`), todas `security_invoker`.
- `private`: funções auxiliares (`is_member`, `has_role`, `assert_role`, `pharmacy_today`, `write_audit`, triggers). Não exposto pela API.
- Chaves estrangeiras compostas `(pharmacy_id, id)` garantem que um lote, movimento ou contagem só referencia registos da mesma farmácia.
- Detalhe: [data-dictionary.md](data-dictionary.md). Segurança: [security.md](security.md).

### Funções RPC

| Função                                                                               | Perfis                                 | Efeito                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `receive_stock`                                                                      | owner, manager, operator               | Cria/actualiza lote e regista entrada                                                  |
| `issue_stock`                                                                        | owner, manager, operator\*             | Saída (venda/consumo, devolução, quebra, expirado, transferência)                      |
| `adjust_stock`                                                                       | owner, manager                         | Ajuste para quantidade contada, com motivo                                             |
| `reverse_movement`                                                                   | owner, manager                         | Movimento inverso ligado ao original                                                   |
| `set_batch_status`                                                                   | owner, manager                         | Bloquear/desbloquear lote                                                              |
| `start_stock_count`, `record_count_item`, `submit_stock_count`, `cancel_stock_count` | owner, manager, operator               | Contagem física                                                                        |
| `approve_stock_count`                                                                | owner, manager                         | Aplica os ajustes da contagem (idempotente)                                            |
| `list_members`                                                                       | todos os membros (email só para owner) | Lista da equipa                                                                        |
| `update_member`                                                                      | owner                                  | Mudar perfil ou desactivar; não se altera a si própria; mantém sempre uma owner activa |

\* Saídas de lotes expirados só com o tipo `expired_disposal`; lotes bloqueados não aceitam saídas normais.

Todas: validam o perfil com `auth.uid()`, bloqueiam o lote com `FOR UPDATE`, nunca deixam stock negativo, escrevem o movimento e a auditoria na mesma transacção.

## Datas, moeda e idioma

Datas de calendário (`date`) guardadas sem fuso; instantes (`timestamptz`) em UTC e apresentados em `Africa/Luanda`, formato `dd/MM/yyyy` e 24 horas. Validade calculada com o dia actual de Luanda. Moeda AOA (`1 500,00 Kz`). Interface em português de Portugal.
