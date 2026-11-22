# Backup e restauro

> **Estado:** scripts escritos e verificados quanto à sintaxe; o ciclo completo (backup → restauro → verificação) corre no CI (`supabase-local`) com dados fictícios e chave efémera. **Não foi executado nesta máquina** (sem Docker). O envio para Cloudflare R2 está **desligado** até à validação jurídica da transferência internacional (secção 10.5 da especificação).

## Camadas de protecção

1. **Backups do fornecedor** — Supabase Pro faz backups diários com retenção de 7 dias (restauro pelo painel). Não dependem destes scripts.
2. **Cópia independente (estes scripts)** — dump lógico cifrado com `age`, SHA-256, manifest; opcionalmente enviado para um bucket R2 privado.

## O que está e não está coberto

| Coberto                                                                                                        | Não coberto                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Estrutura dos schemas `public` e `private` (tabelas, views, funções, RLS, triggers, permissões) — `schema.sql` | Outros schemas geridos pelo Supabase (`storage`, `realtime`, `vault`, `graphql`…)                                |
| Roles personalizadas — `roles.sql`                                                                             | Objectos do Supabase Storage (não usado no MVP)                                                                  |
| Dados de todas as tabelas `public` — `data.sql`                                                                | Configuração do projecto (Auth, SMTP, URLs, MFA, limites) — repor a partir de `supabase/config.toml` e do painel |
| Contas Auth (`auth.users`, `auth.identities`) em CSV — **só se** `BACKUP_INCLUDE_AUTH_USERS=true`              | Edge Functions e os seus segredos (código no repositório; segredos no painel)                                    |
| Contagens de linhas por tabela (`row_counts.tsv`, a partir do próprio dump)                                    | Trigger `on_auth_user_created` em `auth.users` (schema excluído); recriado por `post-restore.sql`                |

O `supabase db dump` exclui por defeito os schemas geridos (`auth`, `storage`, …) e só inclui dados com `--data-only`. Por isso o script faz três dumps separados e exporta as contas Auth à parte. As contas incluem hashes de palavra-passe: por defeito **não** são exportadas; a recuperação de contas tem procedimento próprio (abaixo).

## Chaves de cifra

```bash
age-keygen -o farmastock-backup-key.txt     # gerar NUM COMPUTADOR SEGURO, fora do repositório
age-keygen -y farmastock-backup-key.txt     # imprime a chave pública age1...
```

- A chave **pública** (`age1...`) vai para o secret `BACKUP_ENCRYPTION_RECIPIENT`.
- A chave **privada** guarda-se offline (duas cópias: ex. pen cifrada num cofre + gestor de palavras-passe da administradora técnica). Nunca no GitHub, no bucket, no email ou no chat.
- Sem a chave privada os backups são irrecuperáveis.

## Fazer um backup

Local (base Supabase local, sem envio):

```bash
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
BACKUP_ENCRYPTION_RECIPIENT=age1... \
bash scripts/backup/backup.sh
```

Gera em `backups/` (ignorado pelo git): `farmastock-<carimbo>.tar.gz.age` e `farmastock-<carimbo>.manifest.json` (tamanho, SHA-256, conteúdo, exclusões, contagens). Regista o resultado em `public.backup_runs` (visível no ecrã Segurança, só owner).

Antes de migrações importantes, correr o backup manualmente e guardar a cópia.

## Agendamento (GitHub Actions)

`.github/workflows/backup.yml` — diário às 03:30 (Luanda). **Não corre** enquanto as variáveis do repositório `BACKUP_ENABLED` e `LEGAL_TRANSFER_APPROVED` não estiverem ambas a `true`. Para activar (só depois do parecer jurídico):

1. Criar bucket R2 **privado** e um token com permissão só a esse bucket.
2. Em _Settings → Secrets and variables → Actions_: secrets `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_RECIPIENT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`; criar o environment `backup` (pode exigir aprovação).
3. Fazer um restauro de teste com sucesso.
4. Variáveis `LEGAL_TRANSFER_APPROVED=true` e `BACKUP_ENABLED=true`.

O script recusa enviar se `LEGAL_TRANSFER_APPROVED` não for `true`. Após o envio, descarrega o objecto e compara o SHA-256. Falha do job = notificação do GitHub ao administrador técnico.

**Retenção** (`scripts/backup/retention.sh`): 30 cópias diárias mais a primeira cópia de cada mês durante 12 meses. Sem `--apply` só simula. Como camada extra, configurar também uma regra de ciclo de vida no bucket.

## Teste de restauro (mensal)

Num destino **separado e descartável** — projecto Supabase de teste/staging ou Supabase local. Nunca na produção.

```bash
RESTORE_DB_URL=postgresql://...destino-de-teste... \
RESTORE_TARGET_IS_DISPOSABLE=yes \
BACKUP_DECRYPTION_KEY_FILE=/caminho/seguro/farmastock-backup-key.txt \
bash scripts/restore-test/restore-test.sh backups/farmastock-<carimbo>.tar.gz.age --reset-target
```

O script:

1. Confirma o SHA-256 com o manifest.
2. Decifra e extrai numa pasta temporária (apagada no fim).
3. Com `--reset-target`, apaga os schemas `public`/`private` e as contas Auth do destino.
4. Restaura roles, schema, contas Auth (se existirem) e dados numa única transacção com `session_replication_role = replica` (sem disparar triggers de auditoria); recria o trigger de `auth.users`.
5. Compara as contagens por tabela com o backup.
6. Corre `verify.sql`: RLS activo em todas as tabelas, nenhum stock negativo, stock de cada lote = soma dos movimentos, membros com perfil, triggers de imutabilidade presentes.

Registar cada teste (data, ficheiro, duração, resultado) no runbook do piloto.

## Restaurar produção após incidente

Procedimento técnico, executado só pela administradora técnica autorizada; não existe página web para isso.

1. Preferir o restauro do próprio Supabase (painel → Database → Backups) se o incidente estiver dentro dos 7 dias.
2. Caso contrário, criar **um projecto novo**, aplicar `supabase/config.toml`/configuração do painel, e correr `restore-test.sh` com `RESTORE_DB_URL` desse projecto (o destino é novo, logo descartável até ser promovido).
3. Contas Auth: se o backup as incluir, são restauradas com os mesmos ids e hashes. Se não, pedir a cada utilizador para usar "Recuperar palavra-passe" depois de a owner os convidar de novo; os ids novos exigem actualizar `user_profiles`/`pharmacy_members` com um script SQL assistido (mapa email antigo → id novo).
4. Implementar a Edge Function e os segredos; actualizar `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no Cloudflare Pages.
5. Conferir fisicamente o stock dos produtos movimentados desde o último backup (RPO até 24 h).

Objectivos (não garantias): RPO até 24 horas; RTO até 1 dia útil.
