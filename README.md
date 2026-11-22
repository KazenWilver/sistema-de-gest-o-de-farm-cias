# FarmaStock

Sistema **interno** de gestão de inventário para farmácias (piloto, Luanda). Regista produtos, lotes com validade, entradas, saídas, ajustes, contagens físicas e alertas, com isolamento total entre farmácias.

> **Não é software de facturação.** Não emite facturas, recibos, não tem POS, caixa, impostos, SAF-T nem integração AGT, e não substitui o software fiscal da farmácia. Não guarda dados de pacientes, receitas nem dados de saúde. Não está certificado nem foi validado juridicamente.
>
> **Não utilizar com dados reais** antes de concluir a [lista de verificação jurídica e técnica](docs/privacy-and-legal-checklist.md).

## Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 · React Router · TanStack Query · React Hook Form + Zod · Supabase (Postgres, Auth, RLS, RPC, Edge Functions) · vite-plugin-pwa · Cloudflare Pages · GitHub Actions.

## Requisitos

- Node.js 22+ e npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) e Docker (só para correr a base de dados local)

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local          # preencher com os valores impressos por "supabase start"
supabase start                      # Postgres + Auth + Mailpit locais; aplica migrações e seed
npm run dev                         # http://localhost:5173
```

Contas fictícias do seed (`supabase/seed.sql`), todas com a palavra-passe `FarmaStock-dev-2026`:

| Email                        | Farmácia | Perfil               |
| ---------------------------- | -------- | -------------------- |
| `admin.a@farmastock.test`    | A        | Administradora       |
| `gestor.a@farmastock.test`   | A        | Gestor               |
| `operador.a@farmastock.test` | A        | Funcionário de stock |
| `consulta.a@farmastock.test` | A        | Consulta             |
| `admin.b@farmastock.test`    | B        | Administradora       |

Estas contas existem **apenas** na base local. Nunca correr o seed num projecto de produção.

Para os convites por email no ambiente local, a Edge Function corre com `supabase functions serve team-admin` e os emails aparecem no Mailpit (`http://localhost:54324`).

## Comandos

| Comando                 | O que faz                                                         |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | Servidor de desenvolvimento                                       |
| `npm run build`         | Typecheck + build de produção (`dist/`)                           |
| `npm run preview`       | Serve o build localmente (testar PWA)                             |
| `npm run typecheck`     | TypeScript sem emitir                                             |
| `npm run lint`          | ESLint                                                            |
| `npm run format`        | Prettier (escrever) — `format:check` só verifica                  |
| `npm test`              | Testes unitários + testes SQL (RLS, RPC, imutabilidade) em PGlite |
| `npm run check:secrets` | Procura segredos no repositório e no `dist/`                      |
| `npm run icons`         | Regenera os ícones PNG da PWA                                     |

O teste de concorrência precisa de um Postgres real com as migrações aplicadas:

```bash
supabase db reset
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx vitest run tests/db/concurrency.test.ts
```

## Migrações

| Ficheiro                                                  | Conteúdo                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261122000001_schema.sql`           | Tipos, tabelas, restrições, imutabilidade de movimentos e auditoria                           |
| `supabase/migrations/20261122000002_security.sql`         | Funções auxiliares, RLS, auditoria por trigger, permissões por coluna                         |
| `supabase/migrations/20261122000003_stock_operations.sql` | Views e funções RPC transaccionais (entradas, saídas, ajustes, correcções, contagens, equipa) |

## Variáveis de ambiente

Frontend (`.env.local`, públicas por natureza):

| Variável                 | Descrição                                                |
| ------------------------ | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | URL do projecto Supabase                                 |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon/publishable). Nunca a `service_role` |

Segredos (só em GitHub Secrets, Supabase Edge Function secrets ou na máquina do administrador técnico — **nunca** em `VITE_*` nem no repositório): `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `BACKUP_ENCRYPTION_RECIPIENT`. A Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` (injectada pelo Supabase) e `ALLOWED_ORIGINS` (origens permitidas, separadas por vírgulas).

## Documentação

- [Arquitectura](docs/architecture.md)
- [Dicionário de dados](docs/data-dictionary.md)
- [Segurança](docs/security.md)
- [Backup e restauro](docs/backup-restore.md)
- [Privacidade e lista de verificação jurídica](docs/privacy-and-legal-checklist.md)
- [Guia do utilizador](docs/user-guide.md)
- [Runbook do piloto](docs/pilot-runbook.md)
- [Plano de implementação e decisões](docs/implementation-plan.md)
- Especificação original: [arquitectura-farmastock-piloto.md](arquitectura-farmastock-piloto.md)

## Ainda não implementado

- Ecrã de inscrição de MFA (TOTP). O Supabase Auth já o suporta (`config.toml`); falta a interface.
- Importação de inventário por CSV na aplicação (a importação inicial faz-se por SQL assistido).
- Deploy: nada foi publicado. Cloudflare Pages, projecto Supabase de produção e SMTP ficam por configurar.
- A Edge Function `team-admin`, o teste de concorrência e o ciclo backup/restauro foram escritos mas não executados nesta máquina (sem Docker); correm no job `supabase-local` do CI.
