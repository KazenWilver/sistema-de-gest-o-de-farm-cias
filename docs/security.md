# Segurança

## Princípios

1. A base de dados é a autoridade. A interface só esconde botões.
2. Menor privilégio: o papel `authenticated` só tem os privilégios explicitamente concedidos (por coluna).
3. Isolamento por `pharmacy_id` em todas as tabelas, com RLS e chaves estrangeiras compostas.
4. Stock só muda dentro de funções transaccionais, idempotentes e auditadas.
5. Nenhum segredo no frontend nem no repositório.

## Perfis

| Acção                                                  | owner | manager | stock_operator | viewer |
| ------------------------------------------------------ | :---: | :-----: | :------------: | :----: |
| Ver inventário, lotes, movimentos, alertas, relatórios |   ✓   |    ✓    |       ✓        |   ✓    |
| Exportar CSV                                           |   ✓   |    ✓    |       ✓        |   ✓    |
| Entradas, saídas, contagens                            |   ✓   |    ✓    |       ✓        |        |
| Ajustes, correcções, bloquear lotes, aprovar contagens |   ✓   |    ✓    |                |        |
| Produtos e fornecedores                                |   ✓   |    ✓    |                |        |
| Histórico de auditoria                                 |   ✓   |    ✓    |                |        |
| Equipa, definições da farmácia, estado dos backups     |   ✓   |         |                |        |

## Controlos implementados

**Base de dados**

- RLS em todas as tabelas `public`; políticas com `private.is_member` / `private.has_role` (SECURITY DEFINER, `search_path = ''`).
- `REVOKE ALL` de `anon` e `authenticated` em tabelas, sequências e funções; `GRANT` por coluna só do necessário. `anon` não lê nada.
- `available_quantity`, `stock_movements`, `stock_count_items`, `audit_logs`, `pharmacy_members` não têm escrita directa pelo cliente.
- RPC: validam perfil por `auth.uid()`, nunca confiam em ids sem verificar a farmácia, bloqueiam lote (`FOR UPDATE`), idempotência (advisory lock + índice único), `CHECK` de stock ≥ 0 e de saldo.
- Movimentos e auditoria imutáveis (trigger recusa `UPDATE`/`DELETE`); correcção por movimento inverso.
- Auditoria por trigger em farmácias, membros, produtos, fornecedores e lotes; metadados limitados e sem texto livre.
- Views com `security_invoker = true` (respeitam o RLS de quem consulta).

**Autenticação**

- Registo público desligado (`enable_signup = false`); só por convite da owner.
- Palavra-passe mínima de 12 caracteres, rotação de refresh tokens, limites de pedidos.
- Desactivar um membro corta o acesso aos dados de imediato (RLS); se ficar sem farmácias activas, a Edge Function bloqueia o início de sessão (`ban`).
- MFA TOTP activo no Supabase Auth; **falta o ecrã de inscrição** (recomendado obrigatório para owners antes de dados reais).

**Frontend e PWA**

- Só `VITE_SUPABASE_URL` e a chave pública anon. A `service_role` vive apenas na Edge Function.
- Sem dados de inventário em Cache Storage, `localStorage` ou IndexedDB. Cache de consultas só em memória, limpa ao sair.
- Sem escrita offline. `noindex` nas páginas. CSV exportado neutraliza fórmulas (`=`, `+`, `-`, `@`).
- Cabeçalhos recomendados para Cloudflare Pages (`public/_headers`): ver secção abaixo.

**Repositório e CI**

- `.gitignore` exclui `.env*`, chaves e backups. `npm run check:secrets` procura JWT `service_role`, chaves `sb_secret_`, chaves privadas e variáveis de segredo preenchidas, no repositório e no `dist/`.
- CI corre typecheck, lint, testes (incluindo RLS/RPC em PGlite), build e verificação de segredos.

## Verificações executadas (22/11/2026)

| Verificação                                                                                                                                                       | Resultado                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Testes SQL: isolamento entre farmácias A/B, `anon` sem acesso, perfis, RPC, idempotência, lotes expirados/bloqueados, imutabilidade, contagens, equipa, auditoria | 28 testes passam (PGlite)                                                      |
| Testes unitários de domínio                                                                                                                                       | 18 passam                                                                      |
| Concorrência (10 saídas em paralelo, mesma chave em paralelo)                                                                                                     | **Não executado** localmente (sem Docker); corre no job `supabase-local` do CI |
| `service_role` no `dist/`                                                                                                                                         | 0 ocorrências                                                                  |
| `npm run check:secrets`                                                                                                                                           | Sem segredos                                                                   |
| Edge Function `team-admin`                                                                                                                                        | **Não executada** (sem Supabase local)                                         |

## Cabeçalhos HTTP

`public/_headers` (Cloudflare Pages) define CSP restrita ao próprio domínio e ao projecto Supabase, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e `frame-ancestors 'none'`. Ao configurar o domínio de produção, substituir `*.supabase.co` pelo URL exacto do projecto.

## Antes de dados reais

- Projecto Supabase de produção separado, região escolhida com o jurista.
- MFA na conta owner; SMTP próprio; `site_url` e redirecções para o domínio real.
- Rever políticas com o Supabase Security Advisor.
- Teste de concorrência e restauro executados no ambiente real.
- Plano de resposta a incidentes (ver [pilot-runbook.md](pilot-runbook.md)).
