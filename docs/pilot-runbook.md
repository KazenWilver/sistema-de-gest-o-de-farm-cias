# Runbook do piloto

Operação do piloto numa farmácia. **Pré-condição:** todas as caixas da [lista de verificação](privacy-and-legal-checklist.md) assinaladas. Sem isso, usar apenas dados fictícios.

## 1. Preparar o ambiente (administrador técnico)

1. Criar projecto Supabase de produção (região validada com o jurista), plano com backups.
2. `supabase link --project-ref <ref>` e `supabase db push` (aplica as 3 migrações). **Não** correr `seed.sql`.
3. Auth: SMTP próprio, `site_url` = domínio do Cloudflare Pages, redirecção `/definir-palavra-passe`, registo público desligado, MFA TOTP activo.
4. `supabase functions deploy team-admin` e `supabase secrets set ALLOWED_ORIGINS=https://<domínio>`.
5. Cloudflare Pages: build `npm run build`, pasta `dist`, variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Ajustar `public/_headers` com o URL exacto do Supabase.
6. Criar a farmácia e a primeira administradora (SQL assistido, uma vez):
   - convidar o email no painel Auth;
   - `insert into public.pharmacies (name) values ('…') returning id;`
   - `insert into public.pharmacy_members (pharmacy_id, user_id, role) values ('<farmácia>', '<id do utilizador>', 'owner');`
7. Correr `npm run check:secrets` e o teste de concorrência contra um projecto de staging.
8. Backup manual + restauro de teste num projecto separado ([backup-restore.md](backup-restore.md)).

## 2. Carga inicial do inventário

1. A farmácia entrega a lista de produtos (CSV) — validar nomes, unidades e códigos.
2. Criar produtos (ecrã ou SQL assistido) e registar os lotes existentes como **entradas** com a referência "Inventário inicial", para que tudo tenha histórico.
3. Contagem física completa no primeiro dia e aprovação das diferenças.

## 3. Formação (1–2 horas)

Guia: [user-guide.md](user-guide.md). Praticar com a conta de cada funcionário: entrada, saída, correcção, contagem. Explicar que o sistema não é facturação e não aceita dados de doentes.

## 4. Rotina

| Quando            | Quem                  | O quê                                                         |
| ----------------- | --------------------- | ------------------------------------------------------------- |
| Diário            | Funcionários          | Registar entradas e saídas no momento                         |
| Diário            | Gestor                | Ver alertas (expirados, a expirar, stock baixo)               |
| Semanal           | Gestor                | Contagem parcial dos produtos de maior rotação                |
| Mensal            | Administrador técnico | Teste de restauro; rever `backup_runs`; rever membros activos |
| 30 / 60 / 90 dias | Todos                 | Revisão do piloto: erros, diferenças de contagem, pedidos     |

## 5. Contingência sem Internet

A aplicação não permite registos offline. Registar em papel (folha com data, produto, lote, quantidade, tipo, quem) e lançar no sistema quando a ligação voltar, com a referência "Registo em papel dd/mm".

## 6. Incidentes

| Situação                             | Acção imediata                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Funcionário sai / conta comprometida | Owner desactiva o membro no ecrã Equipa (corta acesso e bloqueia login)                                              |
| Suspeita de acesso indevido          | Desactivar contas afectadas; rever auditoria; rodar a chave anon/JWT no Supabase se necessário; registar o incidente |
| Fuga de segredo (`service_role`, R2) | Rodar a chave no fornecedor de imediato; actualizar secrets; verificar logs                                          |
| Erro grave de stock                  | Não apagar nada; corrigir por movimentos inversos ou contagem                                                        |
| Perda de dados                       | Seguir "Restaurar produção" em [backup-restore.md](backup-restore.md)                                                |

Avaliar com o jurista a obrigação de notificar a APD/titulares e o Centro Nacional de Cibersegurança (Lei n.º 9/26). Registar: data, descoberta, impacto, dados afectados, medidas, notificações.

## 7. Saída do serviço

Exportar inventário e movimentos (CSV) e um dump SQL; entregar à farmácia; eliminar o projecto e os backups no fim da janela de retenção acordada; registar a eliminação.
