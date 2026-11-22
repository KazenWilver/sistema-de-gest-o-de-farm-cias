# Privacidade e lista de verificação jurídica

> Este documento é uma **lista de trabalho técnica**, não um parecer jurídico. Os textos de privacidade e termos incluídos na aplicação (`/aviso-privacidade`, `/termos`, em `src/features/legal/texts.tsx`) são **rascunhos** baseados na secção 12 da especificação, com os campos por preencher destacados entre parênteses rectos. Não foram revistos nem aprovados por jurista. O produto **não** está certificado nem declarado conforme a AGT ou a APD.

## Dados tratados

| Categoria                       | Onde                                       | Finalidade                                               |
| ------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Nome e email de funcionários    | `auth.users`, `user_profiles`              | Acesso à aplicação, convites                             |
| Perfil e farmácia               | `pharmacy_members`                         | Controlo de acessos                                      |
| Autoria de operações            | `stock_movements.created_by`, `audit_logs` | Rastreabilidade do stock e segurança                     |
| Dados técnicos de sessão        | Supabase Auth (IP, user agent, horários)   | Segurança da conta                                       |
| Contactos de fornecedores       | `suppliers` (podem ser pessoas singulares) | Gestão de compras                                        |
| Leitura do aviso de privacidade | `privacy_acknowledgements`                 | Prova de informação ao trabalhador (não é consentimento) |

**Fora do âmbito, por desenho:** pacientes, receitas, diagnósticos, alergias, histórico de saúde, aconselhamento, facturação, recibos, pagamentos.

## Medidas técnicas já implementadas

- Isolamento por farmácia (RLS) e menor privilégio por perfil.
- Auditoria imutável com metadados mínimos (sem texto livre).
- Sem dados de inventário guardados no dispositivo (PWA só com ficheiros estáticos).
- Registo público desligado; só convite.
- Backups cifrados de ponta a ponta com chave privada offline; envio externo desligado.
- Exportação CSV de inventário e movimentos (portabilidade dos dados da farmácia).

## Lista de verificação antes de dados reais (secção 20)

### Jurídico e administrativo

- [ ] Confirmar a entidade legal que presta o serviço e o enquadramento fiscal.
- [ ] Confirmar a notificação/autorização aplicável perante a APD (Lei n.º 22/11).
- [ ] Confirmar o papel da farmácia (responsável) e do fornecedor (subcontratante).
- [ ] Rever e assinar contrato de prestação de serviços.
- [ ] Rever e assinar DPA / acordo de subcontratação.
- [ ] Preencher os campos destacados do aviso de privacidade e dos termos; obter revisão jurídica; só depois publicar e subir `PRIVACY_NOTICE_VERSION`.
- [ ] Confirmar a base legal para cada tratamento (consentimento ou outra).
- [ ] Confirmar transferências internacionais e regiões dos fornecedores: Supabase (região do projecto), Cloudflare (Pages e R2), GitHub (Actions, se processar backups).
- [ ] Avaliar registo e obrigações ao abrigo da Lei n.º 9/26 (Cibersegurança).
- [ ] Confirmar com o farmacêutico responsável as categorias de medicamentos incluídas.
- [ ] Não lançar catálogo público sem parecer sobre a Lei n.º 9/17 e regras sanitárias.

### Técnico e operacional

- [ ] Ambiente de produção separado do desenvolvimento.
- [ ] RLS e testes multi-tenant aprovados no ambiente real (incluindo teste de concorrência).
- [ ] MFA na conta administradora (falta o ecrã de inscrição).
- [ ] Secrets guardados de forma segura (GitHub Secrets / painel Supabase).
- [ ] Backup encriptado configurado e **autorizado** (`LEGAL_TRANSFER_APPROVED`).
- [ ] Teste real de restauro concluído e registado.
- [ ] Plano de resposta a incidentes documentado ([pilot-runbook.md](pilot-runbook.md)).
- [ ] Funcionários formados ([user-guide.md](user-guide.md)).
- [ ] Dados de inventário conferidos fisicamente.
- [ ] Procedimento manual de contingência para falha de Internet.
- [ ] Plano de exportação e saída do serviço testado.

## Direitos dos titulares (procedimento proposto)

- **Acesso/rectificação:** cada utilizador corrige o seu nome em Definições; a owner vê a equipa no ecrã Equipa; o email muda-se no Supabase Auth pelo administrador técnico.
- **Fim de vínculo:** desactivar o membro (acesso cortado de imediato). O histórico de movimentos mantém a autoria por obrigação de rastreabilidade; o prazo de conservação tem de ser definido com o jurista.
- **Eliminação da conta:** só depois do prazo definido; as referências no histórico ficam ligadas ao perfil (sem email).

## Retenção proposta (a validar)

- Movimentos e auditoria: enquanto durar o contrato + prazo legal a definir.
- Backups: 30 diários + 12 mensais.
- Fim do contrato: exportação para a farmácia e eliminação dentro do prazo acordado, incluindo backups no fim da janela de retenção.
