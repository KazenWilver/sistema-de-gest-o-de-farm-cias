# Plano de implementação — FarmaStock (piloto)

Fonte: [`arquitectura-farmastock-piloto.md`](../arquitectura-farmastock-piloto.md). Este plano regista as decisões tomadas ao implementar a especificação.

## Fases

| Fase | Conteúdo                                                                                                                                 | Estado                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A    | Auditoria do repositório (vazio), plano, estrutura                                                                                       | Feito                                                                                         |
| B    | Vite + React + TS, Tailwind, ESLint, Prettier, Vitest, PWA (só assets estáticos)                                                         | Feito                                                                                         |
| C    | Migrações SQL, RLS, funções RPC transaccionais, views, seed fictício                                                                     | Feito                                                                                         |
| D    | Ecrãs: autenticação, dashboard, produtos, lotes, movimentos, contagens, fornecedores, alertas, relatórios, equipa, definições, segurança | Feito                                                                                         |
| E    | Testes unitários, testes SQL multi-tenant/RLS/idempotência, teste de concorrência (Postgres real)                                        | Feito; concorrência escrita mas só corre com `TEST_DATABASE_URL` (job `supabase-local` do CI) |
| F    | Scripts de backup/restauro, workflow agendado desactivado                                                                                | Scripts escritos; ciclo completo só no CI; envio para R2 desligado até validação jurídica     |
| G    | Documentação em `docs/`                                                                                                                  | Feito                                                                                         |

## Decisões técnicas

1. **Stack** exactamente a da especificação (secção 6.1). Sem Next.js nem backend próprio.
2. **Quantidade disponível** vive só em `stock_batches.available_quantity`. O total por produto é sempre calculado pela view `product_stock` (nunca guardado em dois sítios).
3. **Clientes nunca alteram quantidades.** O papel `authenticated` não tem `INSERT/UPDATE` nas colunas de quantidade nem em `stock_movements`. Todas as alterações passam por funções `SECURITY DEFINER` com `search_path` vazio, que validam o perfil com `auth.uid()` e nunca confiam no `pharmacy_id` enviado.
4. **Idempotência:** cada operação recebe `idempotency_key` gerada no cliente quando o formulário abre. A função obtém um `pg_advisory_xact_lock` para (farmácia, chave), devolve o movimento existente se já foi registado e há um índice único `(pharmacy_id, idempotency_key)` como última barreira.
5. **Concorrência:** saídas e ajustes fazem `SELECT ... FOR UPDATE` do lote antes de validar a quantidade; um `CHECK (available_quantity >= 0)` garante que nunca fica negativa.
6. **Validade:** o estado "expirado" é calculado a partir da data (`effective_status` em `batch_overview`) usando o dia actual em `Africa/Luanda`, para não depender de uma tarefa agendada. O estado guardado só distingue `active`, `blocked` e `depleted`.
7. **Janelas de alerta** configuráveis por farmácia (`pharmacies.expiry_alert_days`, por omissão 90/60/30).
8. **Ajustes** só por `owner`/`manager`. O `stock_operator` regista contagens; a aprovação (que gera os ajustes) é do gestor.
9. **Correcções** por `reverse_movement`, que cria o movimento inverso e liga-o ao original (`reverses_movement_id`, único).
10. **Auditoria** por triggers nas tabelas de configuração (produtos, fornecedores, lotes, membros, farmácia). Guarda só os nomes dos campos alterados e os valores de campos críticos (stock mínimo, preço de referência, estado, perfil, activo).
11. **Convites e desactivação de contas** passam pela Edge Function `team-admin`, a única que usa a `service_role` (só no servidor). A desactivação corta o acesso aos dados de imediato por RLS e bloqueia o início de sessão quando o utilizador fica sem farmácias activas.
12. **Fontes do sistema** (sem Google Fonts) para não enviar pedidos a terceiros e para funcionar como PWA.
13. **Testes SQL** correm em PGlite (Postgres compilado para WASM) com um esquema `auth` mínimo que imita o do Supabase. O teste de concorrência precisa de um Postgres real e corre só com `TEST_DATABASE_URL`.

## Riscos e dúvidas em aberto

- Enquadramento jurídico (APD, Lei 9/26, transferências internacionais): bloqueia dados reais. Ver `docs/privacy-and-legal-checklist.md`.
- Supabase Auth exige SMTP próprio em produção para convites fiáveis; no desenvolvimento local usa-se o Inbucket/Mailpit do Supabase CLI.
- MFA (TOTP) está disponível no Supabase Auth; o ecrã de inscrição MFA fica para a próxima iteração (ver "Não implementado" no README).
- Importação de inventário por CSV ficou para a próxima iteração; a importação inicial assistida faz-se por SQL a partir de um CSV validado.
