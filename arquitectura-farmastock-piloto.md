# FARMASTOCK — Arquitectura e especificação completa do projecto-piloto

**Versão:** 1.0  
**Data:** 10 de Novembro de 2026  
**Mercado inicial:** Luanda, Angola  
**Tipo de produto:** aplicação web progressiva (PWA) para gestão interna de inventário de uma farmácia  
**Nome:** `FarmaStock` é um nome de trabalho. Pode ser alterado antes do lançamento.

> **Instrução importante para quem vai desenvolver:** este documento é a especificação funcional e técnica do projecto. Não substitui uma análise jurídica. O produto deve começar com dados fictícios e só pode passar a dados reais depois de a farmácia e o responsável pelo software confirmarem o enquadramento junto da Agência de Protecção de Dados (APD), a legitimidade das transferências internacionais de dados e a aplicabilidade da Lei n.º 9/26, de 28 de Setembro, Lei da Cibersegurança. Não implementar funcionalidades de facturação, POS, dispensa clínica, receitas médicas ou registo de pacientes.

---

# 1. Resumo executivo

O FarmaStock é um sistema simples e seguro para ajudar uma farmácia a controlar os medicamentos e outros produtos de saúde que tem no seu inventário.

A primeira versão será utilizada apenas pela proprietária, pelo responsável técnico e pelos funcionários autorizados da farmácia. Permitirá registar produtos, lotes, quantidades, entradas, saídas, ajustes, datas de validade e fornecedores. Apresentará alertas de stock baixo e de produtos próximos do fim da validade, assim como relatórios internos.

O objectivo do piloto é resolver três problemas concretos:

1. A farmácia não ter uma visão fiável das quantidades realmente disponíveis.
2. A farmácia descobrir demasiado tarde que um medicamento está a acabar ou já ultrapassou a validade.
3. A farmácia perder tempo a consultar cadernos, folhas de cálculo ou vários registos para saber o que tem em stock.

O FarmaStock **não será um programa de facturação** e não substituirá o software fiscal que a farmácia já utiliza. Também não será, nesta primeira fase, uma aplicação pública para pacientes procurarem medicamentos.

## 1.1. Proposta de valor

> Saber o que a farmácia tem, onde está, em que quantidade, a que lote pertence e quando precisa de ser reposto ou retirado de circulação.

## 1.2. Resultado esperado do piloto

No fim do piloto, a farmácia deverá conseguir:

- Consultar o stock de cada produto num único painel.
- Registar entradas e saídas com identificação do funcionário responsável.
- Consultar os lotes e as respectivas datas de validade.
- Detectar produtos com stock baixo, esgotado ou próximo da validade.
- Consultar o histórico de movimentos de cada produto.
- Exportar relatórios internos para CSV.
- Recuperar os dados a partir de uma cópia de segurança testada.

---

# 2. Âmbito do projecto

## 2.1. Incluído na primeira versão (MVP)

- Aplicação PWA responsiva para computador, tablet e telemóvel.
- Autenticação de funcionários por conta individual.
- Uma farmácia no piloto, mas com arquitectura preparada para várias farmácias.
- Gestão de medicamentos e produtos de saúde.
- Gestão de lotes e datas de validade.
- Gestão de fornecedores, com informação comercial mínima.
- Registo de entradas, saídas e ajustes de inventário.
- Contagem física de inventário e reconciliação.
- Alertas de stock baixo, esgotado e validade próxima.
- Dashboard operacional.
- Pesquisa e filtros.
- Histórico imutável de movimentos e registo de auditoria.
- Exportação de inventário e relatórios para CSV.
- Cópias de segurança externas, encriptadas e com teste de restauro.
- Termos de utilização, aviso de privacidade e documentos contratuais em versão preliminar.

## 2.2. Explicitamente fora do âmbito do MVP

Não implementar, nem simular, as seguintes funcionalidades:

- Emissão de facturas, facturas-recibo, recibos, notas de crédito ou documentos fiscais.
- Integração fiscal ou comunicação com a AGT.
- POS, caixa, fecho de caixa, pagamentos ou gestão de dinheiro.
- Contabilidade, cálculo de IVA, SAFT ou apuramento fiscal.
- Registo de vendas com valor fiscal ou emissão de comprovativos de venda.
- Fichas de pacientes, histórico de saúde, diagnósticos ou alergias.
- Registo de receitas médicas ou fotografias de receitas.
- Recomendação de medicamentos, tratamentos, doses ou substituições terapêuticas.
- Publicação aberta de medicamentos, preços ou disponibilidade para o público.
- Marketplace, reservas ou compra online de medicamentos.
- Envio de campanhas publicitárias sobre medicamentos.
- Integração com bancos ou serviços de pagamento.
- Gestão de medicamentos sujeitos a controlo especial, psicotrópicos ou estupefacientes, até validação específica com o farmacêutico responsável e confirmação dos requisitos legais aplicáveis.

O sistema pode registar uma **saída de inventário** e o respectivo motivo operacional. Não pode transformar essa operação numa venda fiscal, recibo, transacção de caixa ou documento equivalente.

## 2.3. Evolução futura, sujeita a validação

- Consulta pública de disponibilidade por farmácia.
- Consulta de preços publicados pela farmácia.
- Pesquisa entre várias farmácias.
- Integração com software de facturação validado, apenas para importar movimentos de stock de forma tecnicamente e legalmente aprovada.
- Aplicação móvel nativa, caso a PWA deixe de ser suficiente.
- Previsões de reposição e análise de consumo.

A consulta pública não deve ser activada automaticamente. A publicidade de medicamentos sujeitos a receita médica é restringida pelo artigo 23.º da Lei n.º 9/17, de 13 de Março. A publicação de disponibilidade e preços deve ser analisada juridicamente, incluindo a distinção entre informação factual e publicidade a medicamentos. Não incluir esta funcionalidade no MVP.

---

# 3. Utilizadores e permissões

O sistema deve ter contas individuais. Não utilizar uma conta partilhada por todos os funcionários.

## 3.1. Perfis

| Perfil | Permissões principais |
|---|---|
| Proprietária / Administradora da farmácia | Acesso total à farmácia, criação e desactivação de utilizadores, consulta de relatórios e configurações. |
| Farmacêutico responsável / Gestor | Gestão de produtos, lotes, movimentos, inventários e relatórios. Pode consultar auditoria. |
| Funcionário de stock | Registo de entradas, saídas, contagens e consulta do inventário. Não pode gerir utilizadores nem alterar configurações críticas. |
| Consulta | Consulta do inventário e dos alertas, sem capacidade de alterar dados. |
| Administrador técnico da plataforma | Administração da infraestrutura. Não deve ter acesso habitual ao conteúdo operacional da farmácia. Qualquer acesso excepcional deve ser autorizado, temporário e auditado. |

A atribuição do perfil de farmacêutico responsável deve ser confirmada pela farmácia. A aplicação não certifica nem substitui habilitações profissionais.

## 3.2. Regras de acesso

- Não permitir registo público de utilizadores.
- Apenas a proprietária ou administradora pode convidar funcionários.
- Cada utilizador só acede às farmácias às quais pertence.
- Um funcionário desactivado deixa imediatamente de conseguir iniciar sessão ou aceder aos dados daquela farmácia.
- A remoção de acesso não apaga automaticamente o histórico de movimentos efectuados pelo funcionário.
- Aplicar princípio do menor privilégio.
- Exigir palavra-passe forte e permitir MFA, começando pela conta administradora.
- Não guardar palavras-passe em tabelas próprias nem em texto simples.

---

# 4. Fluxos funcionais

## 4.1. Primeiro acesso e configuração

1. A administradora recebe um convite criado pelo responsável técnico.
2. Define a palavra-passe e confirma o endereço de acesso.
3. É apresentada informação de privacidade adequada ao utilizador.
4. O utilizador confirma que tomou conhecimento do aviso de privacidade. Este registo é uma confirmação de leitura, não deve ser apresentado como consentimento genérico para qualquer tratamento.
5. A administradora confirma o nome da farmácia, fuso horário `Africa/Luanda`, moeda `AOA` e os dados básicos da unidade.
6. São criados os perfis dos restantes funcionários.
7. A farmácia importa o inventário através de um ficheiro CSV ou introduz os primeiros produtos manualmente.

## 4.2. Registar um medicamento ou produto

Campos recomendados:

- Nome comercial.
- Princípio activo, se aplicável.
- Dosagem/concentração.
- Forma farmacêutica (comprimido, cápsula, xarope, creme, solução, etc.).
- Apresentação (por exemplo, embalagem de 20 comprimidos).
- Unidade de controlo (unidade, caixa, frasco, embalagem, etc.).
- Código interno da farmácia.
- Código de barras, opcional.
- Categoria.
- Stock mínimo.
- Estado activo/inactivo.
- Observações internas não clínicas.

A aplicação deve permitir produtos que não sejam medicamentos, como material de penso ou produtos de higiene, desde que a farmácia os queira controlar.

Não criar campos de diagnóstico, indicação terapêutica, doença do paciente, receita ou dados clínicos.

## 4.3. Registar entrada de stock

1. O funcionário selecciona o produto.
2. Indica o fornecedor, se aplicável.
3. Introduz o número do lote.
4. Introduz a data de validade.
5. Introduz a quantidade recebida.
6. Pode indicar o custo unitário de aquisição, caso a farmácia queira esse dado para controlo interno. Esse valor não gera qualquer documento contabilístico ou fiscal.
7. Confirma a operação.
8. O sistema cria um movimento de entrada e actualiza a quantidade disponível do lote numa única transacção de base de dados.

Não permitir quantidade zero ou negativa numa entrada. Não permitir duplicar por engano o mesmo movimento devido a duplo clique ou reenvio do pedido.

## 4.4. Registar saída de stock

1. O funcionário selecciona o produto e o lote.
2. O sistema apresenta a quantidade disponível.
3. O funcionário indica a quantidade a retirar.
4. Selecciona um motivo operacional: saída registada no sistema externo da farmácia, quebra, dano, devolução ao fornecedor, transferência interna ou outro motivo configurado.
5. Confirma a operação.
6. O sistema reduz a quantidade disponível e cria o movimento correspondente, atomicamente.

O sistema não pergunta o nome do paciente nem regista a razão clínica da saída. Não cria factura, recibo ou comprovativo de venda.

## 4.5. Ajuste de inventário

- Um ajuste exige motivo obrigatório.
- O sistema regista quantidade anterior, quantidade ajustada, diferença, utilizador, data e hora.
- Ajustes não apagam movimentos antigos.
- Um ajuste negativo nunca pode deixar a quantidade disponível abaixo de zero, salvo se existir um processo excepcional explicitamente aprovado pela administradora e documentado.

## 4.6. Contagem física

- Criar sessão de contagem com data, responsável e estado.
- Permitir registar quantidade observada por produto/lote.
- Apresentar diferença entre quantidade do sistema e quantidade física.
- Exigir confirmação do responsável para aplicar os ajustes.
- Guardar o resultado e o histórico.

## 4.7. Lotes e validade

- Cada lote pertence a um produto e a uma farmácia.
- Um lote deve conter número de lote, data de validade e quantidades.
- Um lote com quantidade disponível igual a zero não deve aparecer como disponível.
- Um lote expirado deve ser destacado e não pode ser seleccionado numa saída normal.
- Alertas configuráveis: 90, 60 e 30 dias antes da validade.
- Permitir marcar um lote como bloqueado/retirado, com motivo e utilizador responsável.
- A aplicação pode sugerir o princípio FEFO (First Expired, First Out), sem substituir a decisão do farmacêutico responsável.

## 4.8. Pesquisa e filtros

Pesquisar por:

- Nome comercial.
- Princípio activo.
- Dosagem.
- Forma farmacêutica.
- Apresentação.
- Código interno.
- Código de barras.
- Número de lote.

Filtros:

- Stock baixo.
- Esgotado.
- Próximo da validade.
- Expirado/bloqueado.
- Categoria.
- Fornecedor.

---

# 5. Ecrãs da aplicação

## 5.1. Estrutura de navegação

Menu principal:

1. Visão geral
2. Medicamentos e produtos
3. Lotes e stock
4. Movimentos
5. Contagem de inventário
6. Fornecedores
7. Alertas
8. Relatórios
9. Utilizadores e permissões (apenas administradora)
10. Definições
11. Segurança e cópias de segurança (estado técnico apenas para administradora, sem disponibilizar chaves ou segredos)

## 5.2. Dashboard

Apresentar cartões com:

- Total de produtos activos.
- Total de unidades disponíveis, se a unidade for comparável; não somar caixas, frascos e unidades incompatíveis como se fossem equivalentes.
- Produtos com stock baixo.
- Produtos esgotados.
- Lotes próximos da validade.
- Lotes expirados ou bloqueados.
- Últimos movimentos.

Apresentar listas de acção prioritária:

- Repor stock.
- Verificar validade.
- Rever ajustes recentes.

Evitar gráficos decorativos sem utilidade. O dashboard deve ajudar a decidir o que precisa de atenção.

## 5.3. Tabela de produtos

Colunas sugeridas:

- Nome do produto.
- Princípio activo.
- Dosagem.
- Apresentação.
- Stock disponível.
- Stock mínimo.
- Estado.
- Próxima validade conhecida.
- Acções.

A quantidade disponível deve ser calculada a partir dos lotes activos, e não mantida em dois locais independentes que possam ficar inconsistentes.

## 5.4. Detalhe do produto

Separadores:

- Informação geral.
- Lotes.
- Movimentos.
- Histórico de alterações.

## 5.5. Interface e idioma

- Idioma: português de Portugal, com linguagem simples e adequada ao contexto angolano.
- Moeda: Kz / AOA, apenas para valores internos opcionais.
- Data: `dd/MM/yyyy`.
- Hora: 24 horas.
- Fuso horário: `Africa/Luanda`.
- Interface responsiva, com prioridade para computador e tablet, mas funcional em telemóvel.
- Botões e mensagens claros, sem jargão técnico.
- Confirmar operações que alterem inventário.
- Mostrar mensagens de erro que expliquem o que aconteceu e como corrigir.
- Não utilizar emojis como elementos de interface.

---

# 6. Arquitectura técnica

## 6.1. Stack definida para o piloto

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Frontend | React + TypeScript | Interface e lógica de apresentação. |
| Build/dev server | Vite | Desenvolvimento e compilação da aplicação. |
| PWA | `vite-plugin-pwa` | Manifesto, instalação e service worker. |
| Rotas | React Router | Navegação entre páginas. |
| Estado remoto | TanStack Query | Pedidos, cache e invalidação de dados. |
| Formulários | React Hook Form + Zod | Validação dos formulários. |
| UI | Tailwind CSS e componentes acessíveis | Estilos e componentes reutilizáveis. |
| Backend gerido | Supabase | API, autenticação, funções e serviços. |
| Base de dados | PostgreSQL do Supabase | Dados da aplicação. |
| Autenticação | Supabase Auth | Contas e sessões. |
| Segurança de dados | PostgreSQL RLS | Separação de dados por farmácia e utilizador. |
| Funções de backend | Supabase Edge Functions / PostgreSQL RPC | Operações que exigem validação no servidor. |
| Alojamento frontend | Cloudflare Pages | Publicação dos ficheiros estáticos da PWA. |
| Backups externos | Cloudflare R2, apenas depois de validação legal da transferência | Cópias cifradas da base de dados. |
| Automatização | GitHub Actions | CI/CD e processo agendado de backup, sujeito à validação de transferência internacional. |
| Versionamento | Git + GitHub | Código, migrações e histórico. |

Não criar um backend ASP.NET Core autónomo no MVP. O Supabase desempenha o papel de backend gerido. Não usar Next.js, salvo decisão técnica fundamentada e documentada. O projecto é essencialmente um painel privado autenticado, pelo que React + Vite produz uma aplicação mais simples de publicar como conteúdo estático.

## 6.2. Diagrama lógico

```text
Funcionário / Administradora
          |
          v
PWA React + TypeScript + Vite
          |
          | HTTPS / Supabase client
          v
Supabase
  |-- Auth: identidade e sessão
  |-- PostgreSQL: produtos, lotes, movimentos
  |-- RLS: isolamento por farmácia
  |-- RPC: operações transaccionais de stock
  |-- Edge Functions: operações privilegiadas, quando necessárias
          |
          +---- Backups externos encriptados (após validação jurídica)
                         |
                         v
                    Cloudflare R2
```

## 6.3. Princípios de arquitectura

- Começar com uma aplicação modular, sem microserviços.
- Separar componentes de interface, lógica de domínio e acesso aos dados.
- Toda a regra crítica de inventário deve ser validada no servidor/base de dados.
- O frontend nunca é a autoridade sobre quantidades, permissões ou identidade da farmácia.
- Todas as alterações de inventário devem ocorrer numa transacção.
- Não permitir alteração directa de quantidades sem criar um movimento.
- Todas as tabelas de negócio devem conter `pharmacy_id`.
- Aplicar RLS em todas as tabelas com dados da farmácia.
- Criar migrações SQL versionadas no repositório.
- Usar dados fictícios em `seed.sql`; nunca copiar dados reais para o repositório.
- Nunca colocar segredos, palavras-passe, chaves privadas ou ficheiros `.env` no Git.

---

# 7. Modelo de dados inicial

A primeira versão deve ser multi-tenant ao nível da base de dados, mesmo que só exista uma farmácia no piloto.

## 7.1. Tabelas

### `pharmacies`

- `id` UUID, chave primária.
- `name` texto obrigatório.
- `address` texto opcional.
- `phone` texto opcional.
- `timezone` texto, valor inicial `Africa/Luanda`.
- `currency` texto, valor inicial `AOA`.
- `is_active` boolean.
- `created_at`, `updated_at`.

Não recolher NIF ou outros identificadores da empresa se não forem necessários para o MVP. Se forem necessários para o contrato, devem ser guardados fora do inventário, com acesso limitado.

### `user_profiles`

- `id` UUID, igual ao ID do Supabase Auth.
- `display_name` texto opcional.
- `created_at`, `updated_at`.

Não duplicar palavras-passe ou tokens. O email e os métodos de autenticação ficam sob gestão do Supabase Auth.

### `pharmacy_members`

- `id` UUID.
- `pharmacy_id` UUID, FK.
- `user_id` UUID, FK para `user_profiles`.
- `role` enum: `owner`, `manager`, `stock_operator`, `viewer`.
- `is_active` boolean.
- `created_at`, `updated_at`.
- Restrição única (`pharmacy_id`, `user_id`).

### `products`

- `id` UUID.
- `pharmacy_id` UUID, FK.
- `name` texto obrigatório.
- `active_ingredient` texto opcional.
- `brand` texto opcional.
- `strength` texto opcional.
- `dosage_form` texto opcional.
- `presentation` texto opcional.
- `unit_name` texto obrigatório.
- `barcode` texto opcional.
- `internal_code` texto opcional.
- `category` texto opcional.
- `minimum_stock` numeric, valor >= 0.
- `notes` texto opcional, com limite de caracteres e sem dados de pacientes.
- `is_active` boolean.
- `created_by`, `created_at`, `updated_at`.

Criar índices de pesquisa em `name`, `active_ingredient`, `barcode` e `internal_code`. A unicidade de códigos deve ser por farmácia, quando preenchidos.

### `suppliers`

- `id` UUID.
- `pharmacy_id` UUID, FK.
- `name` texto obrigatório.
- `phone` texto opcional.
- `email` texto opcional.
- `notes` texto opcional.
- `is_active` boolean.
- `created_at`, `updated_at`.

Guardar apenas contactos profissionais necessários. Evitar dados pessoais dos representantes comerciais que não sejam necessários.

### `stock_batches`

- `id` UUID.
- `pharmacy_id` UUID, FK.
- `product_id` UUID, FK.
- `supplier_id` UUID, FK opcional.
- `lot_number` texto obrigatório.
- `expiry_date` date obrigatória para medicamentos quando aplicável.
- `received_quantity` numeric obrigatório, maior que zero.
- `available_quantity` numeric obrigatório, >= 0.
- `purchase_unit_cost` numeric opcional, >= 0.
- `reference_sale_price` numeric opcional, >= 0, apenas informativo e interno; não é preço fiscal nem documento de venda.
- `received_at` timestamptz.
- `status` enum: `active`, `blocked`, `expired`, `depleted`.
- `created_by`, `created_at`, `updated_at`.

A quantidade actual não pode ultrapassar a recebida, excepto se existir um processo formal de correcção por movimento. Não apagar lotes com movimentos associados.

### `stock_movements`

- `id` UUID.
- `pharmacy_id` UUID, FK.
- `product_id` UUID, FK.
- `batch_id` UUID, FK opcional em movimentos de ajuste geral, mas preferir lote sempre que possível.
- `movement_type` enum: `receipt`, `issue`, `adjustment_in`, `adjustment_out`, `return_to_supplier`, `internal_transfer_in`, `internal_transfer_out`, `expired_disposal`, `damage`.
- `quantity` numeric obrigatório, maior que zero.
- `quantity_before` numeric.
- `quantity_after` numeric.
- `reason` texto obrigatório para ajustes e saídas excepcionais.
- `reference` texto opcional, sem dados de pacientes ou números de facturas fiscais.
- `created_by` UUID.
- `created_at` timestamptz.
- `idempotency_key` UUID/texto único por farmácia para impedir duplicação de pedidos.

Os movimentos são históricos. Não permitir `UPDATE` ou `DELETE` normal. Para corrigir, criar um movimento inverso/correctivo, preservando o original.

### `stock_counts`

- `id` UUID.
- `pharmacy_id` UUID.
- `status` enum: `draft`, `in_progress`, `review`, `completed`, `cancelled`.
- `started_by`, `approved_by` UUID.
- `started_at`, `completed_at`.
- `notes` texto opcional.

### `stock_count_items`

- `id` UUID.
- `pharmacy_id` UUID.
- `stock_count_id` UUID.
- `product_id` UUID.
- `batch_id` UUID opcional.
- `expected_quantity` numeric.
- `counted_quantity` numeric.
- `difference` numeric calculada ou validada no servidor.
- `created_at`, `updated_at`.

### `audit_logs`

- `id` UUID.
- `pharmacy_id` UUID.
- `actor_user_id` UUID opcional para eventos de sistema.
- `action` texto/enum.
- `entity_type` texto.
- `entity_id` UUID/texto.
- `metadata` JSONB limitado a dados operacionais não sensíveis.
- `created_at` timestamptz.

A auditoria deve registar operações relevantes, mas não deve guardar palavras-passe, tokens, receitas, informação clínica ou dados pessoais desnecessários.

### `backup_runs` (metadados técnicos)

- `id` UUID.
- `status` enum: `started`, `success`, `failed`.
- `started_at`, `finished_at`.
- `file_name` texto.
- `file_size_bytes` bigint opcional.
- `sha256_checksum` texto opcional.
- `destination` texto, sem credenciais.
- `error_summary` texto sanitizado.

A tabela não deve guardar chaves, URLs privadas com tokens ou segredos.

## 7.2. Relações

```text
pharmacies 1---N pharmacy_members N---1 user_profiles
pharmacies 1---N products
pharmacies 1---N suppliers
products   1---N stock_batches
products   1---N stock_movements
stock_batches 1---N stock_movements
pharmacies 1---N stock_counts
stock_counts 1---N stock_count_items
pharmacies 1---N audit_logs
```

## 7.3. Views e consultas

Criar views ou funções seguras para:

- Quantidade total disponível por produto.
- Próxima data de validade por produto.
- Produtos abaixo do stock mínimo.
- Lotes dentro das janelas de validade.
- Resumo de movimentos por período.

As views devem respeitar o isolamento por farmácia e não contornar RLS.

---

# 8. Regras de negócio críticas

1. A quantidade de um lote nunca pode ficar negativa.
2. Entradas e saídas devem actualizar o lote e criar o movimento na mesma transacção.
3. Operações repetidas não podem gerar movimentos duplicados. Usar chave de idempotência.
4. Um utilizador não pode operar sobre uma farmácia à qual não pertence.
5. Um lote expirado ou bloqueado não pode ser usado numa saída normal.
6. O sistema deve avisar quando a validade está próxima, mas não decide se um produto pode ser dispensado.
7. Não é possível apagar um produto que tenha movimentos históricos. Deve ser desactivado.
8. Alterações a stock mínimo, preço de referência, estado de lote e dados críticos devem ficar auditadas.
9. Datas devem ser guardadas em UTC quando são timestamps e apresentadas no fuso `Africa/Luanda`.
10. O backend deve validar os dados mesmo que o frontend já os valide.
11. As operações devem tratar concorrência: duas pessoas a retirar o último lote não podem fazer com que o stock fique negativo.
12. Ajustes devem exigir motivo e, conforme o perfil, aprovação do gestor.
13. Exportações devem aplicar o mesmo isolamento e permissões das páginas normais.

Implementar as operações críticas em funções PostgreSQL/RPC transaccionais ou Edge Functions que chamem funções SQL seguras. Não confiar em operações separadas no cliente para primeiro alterar a quantidade e depois inserir o movimento.

---

# 9. Segurança técnica

## 9.1. Autenticação

- Supabase Auth com convites e contas individuais.
- Desactivar o registo público.
- Palavra-passe forte e recuperação por fluxo seguro.
- MFA para administradora, se suportado no plano escolhido.
- Sessões com expiração e renovação seguras.
- Não guardar tokens em `localStorage` manualmente.

## 9.2. Row Level Security (RLS)

Activar RLS em todas as tabelas da aplicação.

Cada política deve confirmar a pertença do utilizador à `pharmacy_id` consultada. Não aceitar um `pharmacy_id` fornecido pelo frontend como prova de autorização.

Criar funções SQL auxiliares seguras, com `search_path` fixo, validação explícita de identidade e permissões mínimas. Evitar funções `SECURITY DEFINER` desnecessárias. Se forem utilizadas, rever cuidadosamente a propriedade, o `search_path`, as permissões de execução e a validação do utilizador.

A chave `service_role` nunca pode aparecer no bundle do frontend, nas variáveis `VITE_*`, no Git ou em respostas da API. A chave pública/anon ou publishable do Supabase pode estar no frontend apenas com RLS correcto e políticas testadas.

## 9.3. Protecção da aplicação

- HTTPS obrigatório.
- Validar e normalizar todos os inputs.
- Prevenir XSS e SQL injection (usar consultas parametrizadas e API oficial).
- Limitar tentativas de autenticação e operações sensíveis.
- Não expor detalhes internos em erros.
- Sanitizar logs.
- Não registar dados completos de formulários nos logs.
- Rever dependências e manter actualizações de segurança.
- Configurar cabeçalhos de segurança compatíveis com a aplicação.
- MFA para administradores e acesso técnico.
- Registar acções críticas.
- Separar desenvolvimento, staging e produção.
- Nunca utilizar dados reais de produção em staging.

## 9.4. PWA e funcionamento offline

A primeira versão será instalável como PWA, mas **não terá escrita offline de stock**.

- Cachear apenas ficheiros estáticos e o shell da aplicação.
- Não guardar dados de inventário, lotes, fornecedores ou utilizadores em Cache Storage ou `localStorage`.
- Não mostrar dados antigos como se fossem actuais.
- Se a ligação cair, apresentar aviso claro: “Sem ligação à Internet. As alterações ao stock estão temporariamente indisponíveis.”
- Não aceitar saídas/entradas sem confirmação do servidor.
- Não usar service worker para guardar respostas autenticadas da API.

Uma futura fase offline poderá usar IndexedDB, fila de operações, sincronização e resolução de conflitos, mas só depois de um desenho de segurança e testes específicos.

---

# 10. Cópias de segurança e recuperação

## 10.1. Objectivo

Manter cópias independentes do fornecedor principal e ter um procedimento documentado para recuperar os dados.

## 10.2. Plano proposto

- Backup diário da base de dados de aplicação.
- Backup antes de alterações importantes de esquema ou migrações.
- Encriptação antes do envio para armazenamento externo.
- Bucket privado, sem acesso público.
- Retenção proposta: 30 cópias diárias e 12 cópias mensais.
- Verificação do checksum SHA-256.
- Registo de sucesso/falha.
- Alerta ao administrador técnico em caso de falha.
- Teste de restauro mensal numa base de dados separada.
- Manter a chave privada de desencriptação fora do GitHub e fora do próprio bucket, guardada num local seguro offline.

## 10.3. Fluxo de backup

```text
Agendamento diário
      |
      v
Executar exportação da base de dados da aplicação
      |
      v
Validar se o ficheiro foi criado e não está vazio
      |
      v
Comprimir e encriptar
      |
      v
Calcular SHA-256
      |
      v
Enviar para bucket privado no armazenamento externo
      |
      v
Confirmar que o objecto existe e comparar checksum
      |
      v
Registar sucesso ou falha
      |
      v
Aplicar política de retenção
```

## 10.4. Atenção às limitações do Supabase CLI

O `supabase db dump` exclui, por predefinição, esquemas geridos pelo Supabase, incluindo `auth` e `storage`, e o dump por defeito não inclui dados nem funções/roles personalizados sem opções específicas. Os objectos guardados através do Supabase Storage também não são incluídos nos backups normais da base de dados. A implementação tem de documentar exactamente o que está e não está coberto.

Para o MVP, não utilizar Supabase Storage para ficheiros de negócio. O sistema deve manter os documentos fora do âmbito inicial. A recuperação de contas Supabase Auth deve ter um procedimento testado, separado do restauro das tabelas da aplicação. Não prometer “backup completo” sem verificar a cobertura real.

## 10.5. Automatização e fornecedores

GitHub Actions pode executar o processo agendado e Cloudflare R2 pode armazenar a cópia encriptada. Contudo, o runner do GitHub e o R2 podem estar fora de Angola. O facto de o backup estar encriptado não elimina automaticamente a questão jurídica da transferência internacional.

**Não activar o envio de cópias com dados reais para GitHub Actions ou R2 antes de confirmar com a APD/jurista se a transferência é permitida e quais as formalidades necessárias.** Antes dessa confirmação, utilizar apenas dados fictícios ou backups de teste.

Não criar uma página web que permita descarregar ou restaurar backups por qualquer utilizador da farmácia. A restauração deve ser um procedimento técnico, autenticado, documentado e executado por um administrador autorizado.

## 10.6. Objectivos de recuperação propostos

Para o piloto:

- RPO (perda máxima de dados desejada): até 24 horas, dependente do último backup válido.
- RTO (tempo-alvo para recuperar o serviço): até 1 dia útil, sujeito à disponibilidade do fornecedor e à complexidade do incidente.

Estes valores são objectivos operacionais, não garantias absolutas. Devem ser revistos com a farmácia e incluídos no contrato com linguagem realista.

---

# 11. Privacidade e protecção de dados — enquadramento e regras do produto

## 11.1. Princípio principal

O MVP deve ser desenhado para **não recolher dados de pacientes**.

Os dados de inventário, como nome do medicamento, lote, quantidade e validade, são normalmente dados comerciais da farmácia. Não são, por si só, dados pessoais de saúde de um paciente identificável. No entanto, as contas dos funcionários, identificadores, contactos e registos de actividade podem ser dados pessoais.

Se o sistema associar um medicamento a uma pessoa identificada, a uma receita, doença, diagnóstico, alergia ou histórico de utilização, poderá passar a tratar dados pessoais relativos à saúde, considerados sensíveis pela Lei n.º 22/11. Isso exige uma análise e condições reforçadas. O MVP não deve permitir esse tipo de registo.

## 11.2. Quem é quem no tratamento

A estrutura contratual proposta é:

- **Farmácia:** responsável pelo tratamento dos dados pessoais dos seus trabalhadores/utilizadores e por determinar as finalidades e os meios de utilização do sistema.
- **Fornecedor/desenvolvedor do FarmaStock:** subcontratante/operador, tratando dados pessoais apenas por instruções documentadas da farmácia, para alojar, manter e prestar suporte ao sistema.
- **Supabase, Cloudflare e outros fornecedores técnicos:** possíveis subcontratantes subsequentes, conforme o serviço, a localização dos dados e os termos contratuais aplicáveis.

A qualificação jurídica final depende da operação concreta e dos contratos. O desenvolvedor pode ser responsável autónomo por dados que recolha para facturação, contratos, suporte ou gestão da sua própria relação comercial com a farmácia.

## 11.3. Legislação a verificar antes de produção

### Lei n.º 22/11, de 17 de Junho — Lei da Protecção de Dados Pessoais

A Lei n.º 22/11 estabelece regras para tratamento de dados pessoais, incluindo princípios de transparência, licitude, finalidade, exactidão, conservação limitada, direitos dos titulares e segurança.

Pontos particularmente relevantes:

- Artigos 12.º e 35.º: o tratamento está sujeito às condições legais aplicáveis e, em regra, a notificação prévia à APD ou autorização, conforme o caso. Não assumir que uma caixa de consentimento na aplicação resolve todas as obrigações.
- Artigos 13.º e 14.º: dados sensíveis e dados relativos à saúde têm condições específicas e reforçadas.
- Artigo 23.º: a relação com um subcontratante deve estar documentada por escrito, com obrigações de confidencialidade, segurança, instruções e devolução ou destruição dos dados, além das formalidades junto da APD.
- Artigos 25.º a 27.º: informação aos titulares e direitos de acesso, rectificação, actualização, cancelamento e oposição.
- Artigos 30.º a 32.º: medidas de segurança e sigilo profissional.
- Artigos 33.º e 34.º: transferências internacionais para países com nível de protecção adequado ou não adequado, com notificação ou autorização nos termos da lei.

A farmácia e o fornecedor devem confirmar junto da APD qual a formalidade aplicável ao tratamento de contas de funcionários e registos de acesso, bem como a legitimidade das transferências associadas aos fornecedores tecnológicos.

### Lei n.º 9/26, de 28 de Setembro — Lei da Cibersegurança

A Lei n.º 9/26 entrou em vigor em Setembro de 2026 e tem um âmbito amplo. A definição de serviços digitais refere aplicações de Internet exploradas profissionalmente com fins económicos. O artigo 16.º estabelece obrigações para prestadores de serviços digitais, incluindo registos técnicos proporcionais, medidas de segurança, gestão e resposta a incidentes e registo no Centro Nacional de Cibersegurança. O artigo 64.º estabelece um prazo transitório de 180 dias para as entidades sujeitas a registo.

Como o FarmaStock pode ser comercializado como aplicação SaaS, o fornecedor deve obter aconselhamento jurídico sobre a sua classificação como prestador de serviços digitais e confirmar se tem de se registar no Centro Nacional de Cibersegurança, bem como quais as obrigações e prazos concretos. Não assumir que, por ser um projecto pequeno ou de um único cliente, fica automaticamente excluído.

### Lei n.º 9/17, de 13 de Março — Publicidade

O artigo 23.º restringe a publicidade a tratamentos médicos e medicamentos sujeitos a receita médica e condiciona publicidade de medicamentos não sujeitos a receita médica por entidades privadas. Por isso, o catálogo público de disponibilidade/preço fica fora do MVP e carece de validação jurídica antes de ser lançado.

## 11.4. Fornecedores cloud e transferências internacionais

Antes de escolher e activar o ambiente de produção, elaborar uma ficha com:

- Nome de cada fornecedor.
- Serviço utilizado.
- País/região onde os dados são alojados.
- Países a partir dos quais o fornecedor pode aceder remotamente aos dados.
- Subcontratantes subsequentes conhecidos.
- Tipo de informação tratado.
- Condições contratuais de segurança, confidencialidade, eliminação, portabilidade e incidentes.
- Mecanismo legal para eventual transferência internacional e formalidade perante a APD.

Fornecedores previstos:

| Fornecedor | Utilização | Questão a confirmar |
|---|---|---|
| Supabase | Base de dados, autenticação e API | Região real do projecto, acesso remoto, subcontratantes e transferência internacional. |
| Cloudflare Pages | Alojamento da interface | Logs, metadados de acesso, localização e termos aplicáveis. |
| Cloudflare R2 | Backups externos | Jurisdição/localização efectiva, acesso e condições de transferência. |
| GitHub | Repositório e eventualmente CI/CD | Não guardar dados reais no repositório. Se o runner processar backups, avaliar a transferência. |
| Serviço de e-mail, caso seja acrescentado | Convites e notificações | País, dados transmitidos e contrato. Não adicionar no MVP sem necessidade. |

Não afirmar que a utilização de encriptação elimina automaticamente obrigações de transferência internacional. A APD deve confirmar o nível de protecção e o procedimento aplicável.

## 11.5. Dados recolhidos e finalidades

| Categoria | Dados | Finalidade |
|---|---|---|
| Dados da farmácia | Nome e dados básicos da unidade | Identificar a conta da farmácia e configurar o serviço. |
| Contas de utilizador | Nome de apresentação, email ou identificador de acesso | Autenticação e atribuição de permissões. |
| Registos de actividade | Utilizador, acção, data/hora e elemento alterado | Segurança, rastreabilidade e resolução de erros. |
| Inventário | Produto, lote, quantidade, validade, fornecedor | Gestão operacional do stock. |
| Dados técnicos | Logs técnicos minimizados, IP quando estritamente necessário, eventos de segurança | Segurança, diagnóstico e prevenção de abuso. |

Não recolher no MVP:

- Nome, NIF, telefone ou endereço de pacientes.
- Diagnósticos, doenças, alergias ou histórico clínico.
- Receitas médicas ou fotografias de receitas.
- Informação sobre quem comprou ou recebeu determinado medicamento.
- Dados de cartões bancários ou credenciais financeiras.
- Dados pessoais dos clientes da farmácia.

## 11.6. Consentimento, informação e aceitação

A aplicação não deve mostrar uma caixa genérica “Aceito a Política de Privacidade” como se isso substituísse todas as obrigações legais.

O procedimento proposto é:

1. A farmácia assina o contrato de prestação de serviços e o acordo de tratamento de dados (DPA), depois de estes documentos serem revistos.
2. A farmácia, como responsável pelo tratamento, informa os trabalhadores sobre os dados de conta e registos de utilização tratados no sistema.
3. No primeiro acesso, cada trabalhador vê o aviso de privacidade e assinala “Li e tomei conhecimento”. A aplicação regista a versão do aviso e a data/hora.
4. Esta confirmação de leitura não deve ser confundida com consentimento legal quando a base de licitude for outra, como a execução de contrato ou cumprimento de obrigação legal.
5. Se, numa fase futura, houver uma finalidade que dependa realmente de consentimento, deve existir um consentimento separado, específico, informado, livre, inequívoco e demonstrável, sem caixas pré-seleccionadas.
6. O sistema não deve recolher dados de saúde de pacientes no piloto. Se isso vier a ser proposto, parar o desenvolvimento dessa funcionalidade até existir análise jurídica, base legal, autorização aplicável da APD e medidas reforçadas.

## 11.7. Direitos dos titulares

A política e a aplicação devem explicar como um trabalhador pode pedir, através da farmácia:

- Acesso à informação que lhe diga respeito.
- Correcção de dados incorrectos.
- Actualização de dados.
- Cancelamento ou eliminação quando legalmente aplicável.
- Oposição nos casos previstos na lei.
- Esclarecimento sobre finalidades e destinatários.

O pedido deve ser encaminhado para a farmácia, que é a responsável pelo tratamento no contexto laboral. O fornecedor técnico presta apoio à farmácia, mas não decide sozinho sobre pedidos do titular.

## 11.8. Conservação e eliminação

Definir períodos proporcionais e confirmar os prazos legais e contratuais antes da produção:

- Contas activas: enquanto o trabalhador precisar de acesso.
- Contas desactivadas: desactivar imediatamente; eliminar ou anonimizar dados pessoais quando já não forem necessários e quando a farmácia autorizar, respeitando obrigações legais e preservando a integridade dos registos que devam permanecer.
- Inventário e movimentos: enquanto a farmácia utilizar o sistema e durante o período adicional que a farmácia justificar e aprovar.
- Logs de segurança: período mínimo necessário para segurança e auditoria, a definir com a farmácia.
- Backups: retenção proposta de 30 dias diários e 12 cópias mensais, com eliminação automática no fim do prazo, salvo obrigação legal ou incidente de segurança.
- Após fim do contrato: disponibilizar exportação de dados à farmácia e eliminar as cópias do fornecedor dentro do prazo acordado, incluindo backups após o fim da sua janela de retenção.

Não inventar prazos legais de arquivo. Os prazos de conservação de dados comerciais/farmacêuticos devem ser confirmados com a farmácia e o consultor jurídico.

## 11.9. Incidentes de segurança

O fornecedor deve:

- Ter um canal interno para reportar incidentes.
- Registar data, hora, sistemas afectados e medidas de contenção.
- Informar a farmácia sem atraso injustificado, de acordo com o contrato.
- Apoiar a farmácia a avaliar se é necessário notificar a APD, o Centro Nacional de Cibersegurança/CERT.ao ou os titulares, conforme a legislação aplicável.
- Não ocultar incidentes nem afirmar que não houve impacto sem investigação.
- Preservar evidências técnicas necessárias, com acesso limitado.

A Lei n.º 9/26 prevê também deveres de comunicação de ameaças/incidentes para entidades abrangidas. A classificação do fornecedor e os canais/prazos concretos devem ser confirmados com o Centro Nacional de Cibersegurança e com apoio jurídico. A notificação à autoridade de cibersegurança não substitui a que seja devida à APD.

---

# 12. Documentos legais e textos preliminares

**Todos os textos desta secção são modelos de trabalho. Não publicar nem assinar sem preencher os campos em falta e obter revisão de um jurista angolano.**

## 12.1. Aviso de privacidade para funcionários/utilizadores

### Aviso de Privacidade — FarmaStock

**Responsável pelo tratamento:** [NOME LEGAL DA FARMÁCIA]  
**Morada:** [MORADA DA FARMÁCIA]  
**Contacto:** [EMAIL/TELEFONE PARA PEDIDOS DE PRIVACIDADE]  
**Fornecedor técnico:** [NOME LEGAL DO DESENVOLVEDOR/FORNECEDOR]  
**Versão:** 1.0  
**Data de entrada em vigor:** [DATA]

A [NOME DA FARMÁCIA] utiliza o FarmaStock para gerir o inventário de medicamentos e outros produtos de saúde. Este aviso explica que dados podem ser tratados quando um funcionário utiliza a aplicação.

**Que dados são tratados?**

- Nome de apresentação e identificador de acesso do utilizador.
- Informação necessária para autenticação e gestão de permissões.
- Registos de operações realizadas no sistema, como entradas, saídas e ajustes de stock.
- Informação técnica estritamente necessária para manter a segurança e resolver problemas.

**Para que são utilizados?**

Os dados são utilizados para permitir o acesso ao sistema, identificar quem realizou operações, proteger o inventário, manter o histórico de alterações e prestar apoio técnico.

**Que dados não devem ser introduzidos?**

O FarmaStock não deve ser utilizado para registar dados de pacientes, receitas médicas, diagnósticos, doenças, alergias ou histórico de saúde. Não introduza informação pessoal de clientes nos campos de observações.

**Quem pode aceder?**

Os utilizadores autorizados da farmácia podem aceder aos dados necessários às suas funções. O fornecedor técnico pode aceder a informação técnica ou operacional apenas quando necessário para prestar o serviço, resolver problemas ou cumprir obrigações legais, com acesso limitado e registo da intervenção.

**Onde são alojados os dados?**

[IDENTIFICAR OS FORNECEDORES, PAÍSES/REGIÕES E CONDIÇÕES DE TRANSFERÊNCIA APÓS VALIDAÇÃO JURÍDICA.]

**Durante quanto tempo?**

Os dados são conservados enquanto forem necessários para as finalidades indicadas e de acordo com os prazos legais e operacionais definidos pela farmácia. Os dados de conta são revistos quando o acesso do trabalhador termina. Os backups seguem uma política de retenção limitada.

**Quais são os seus direitos?**

Pode solicitar informação, acesso, rectificação, actualização, cancelamento ou exercer oposição nos termos aplicáveis. Para o efeito, contacte [CONTACTO DA FARMÁCIA].

**Segurança**

A aplicação utiliza controlos de acesso, autenticação, cifragem das comunicações, registos de actividade e cópias de segurança. Nenhum sistema ligado à Internet pode garantir risco zero.

Para qualquer questão sobre este aviso, contacte [CONTACTO].

### Registo de leitura no primeiro acesso

Texto da interface:

> Tomei conhecimento do Aviso de Privacidade do FarmaStock e sei que devo utilizar o sistema apenas para tarefas relacionadas com a gestão interna do inventário da farmácia. Não devo introduzir dados de pacientes, receitas médicas ou informação clínica.

Botão: **Confirmar leitura e continuar**

Guardar: utilizador, ID da versão do aviso, data/hora e resultado. Não designar este registo como “consentimento para todos os tratamentos”.

## 12.2. Política de Privacidade da plataforma

### Política de Privacidade — FarmaStock

**Fornecedor da plataforma:** [NOME LEGAL]  
**NIF:** [NIF, SE APLICÁVEL]  
**Morada:** [MORADA]  
**Contacto de privacidade:** [EMAIL]  
**Versão/Data:** [VERSÃO E DATA]

#### 1. Finalidade

Esta política explica como o fornecedor do FarmaStock trata informação no âmbito da disponibilização, manutenção, segurança e apoio técnico da aplicação.

#### 2. Papéis e responsabilidades

A farmácia cliente decide que informação de inventário introduz e quem pode utilizar a aplicação. No tratamento de dados pessoais dos seus funcionários para gestão de acessos e rastreabilidade do inventário, a farmácia actua, em princípio, como responsável pelo tratamento. O fornecedor actua como subcontratante na medida em que trata esses dados por instrução da farmácia. Para os dados que recolhe para gerir o seu próprio contrato, facturação, cobrança e suporte comercial, o fornecedor poderá actuar como responsável autónomo.

#### 3. Categorias de dados

A plataforma pode tratar dados de identificação e autenticação dos utilizadores, registos técnicos, dados de inventário, lotes, quantidades, datas de validade e fornecedores. O MVP não se destina a tratar dados pessoais de pacientes ou dados clínicos.

#### 4. Finalidades

- Disponibilizar o software.
- Autenticar utilizadores e gerir permissões.
- Manter a integridade do inventário.
- Criar histórico e auditoria das operações.
- Prestar suporte e corrigir falhas.
- Proteger a disponibilidade e segurança do serviço.
- Cumprir obrigações legais e contratuais.

#### 5. Fundamento do tratamento

O fundamento aplicável é determinado pela farmácia para os tratamentos que realiza como responsável. O fornecedor deve tratar os dados de acordo com o contrato e as instruções documentadas da farmácia. Para os seus próprios dados de contacto, gestão de contrato e obrigações fiscais, o fornecedor deve identificar o fundamento legal aplicável. O consentimento não deve ser usado de forma genérica quando não é o fundamento adequado.

#### 6. Destinatários e fornecedores

Podem existir prestadores de alojamento, base de dados, autenticação, armazenamento de backups, monitorização ou suporte. A lista efectiva e a localização dos dados devem ser disponibilizadas à farmácia antes da entrada em produção. Nenhum fornecedor deve usar dados da farmácia para publicidade, criação de perfis ou finalidades próprias incompatíveis com as instruções contratuais.

#### 7. Transferências internacionais

A utilização de fornecedores localizados fora de Angola pode envolver transferência internacional de dados. A plataforma só deve ser utilizada com dados pessoais reais depois de o mecanismo aplicável e as formalidades perante a APD estarem confirmados. A localização do fornecedor e dos backups deve ser comunicada de forma transparente.

#### 8. Conservação

Os dados são conservados pelo período necessário para prestar o serviço e cumprir as obrigações legais e contratuais. No fim do contrato, a farmácia pode solicitar exportação dos dados. A eliminação dos backups ocorre de acordo com a janela de retenção acordada.

#### 9. Segurança

O fornecedor aplica medidas proporcionais ao risco, incluindo autenticação, permissões, isolamento por farmácia, cifragem em trânsito, registos de auditoria, actualizações e cópias de segurança. O fornecedor revê periodicamente as configurações e corrige vulnerabilidades identificadas.

#### 10. Direitos dos titulares

Os pedidos relativos aos trabalhadores devem ser dirigidos à farmácia, salvo quando se refiram a tratamentos em que o fornecedor seja responsável autónomo. O fornecedor ajudará a farmácia a responder aos pedidos que dependam dos dados alojados no sistema.

#### 11. Incidentes

O fornecedor mantém um processo de resposta a incidentes e informa a farmácia sem atraso injustificado quando um incidente puder afectar os dados ou a disponibilidade do serviço. A notificação às autoridades será efectuada pela entidade a quem a lei atribuir essa obrigação, com a colaboração necessária entre as partes.

#### 12. Alterações

A política pode ser actualizada por motivos legais, técnicos ou operacionais. A versão actualizada será disponibilizada na aplicação e comunicada à farmácia. Alterações materiais devem ser registadas.

#### 13. Contactos

Questões ou pedidos: [EMAIL] / [MORADA].

## 12.3. Termos de Utilização da aplicação

### Termos de Utilização — FarmaStock

**Fornecedor:** [NOME LEGAL DO FORNECEDOR]  
**Cliente:** cada farmácia que contrata o serviço  
**Versão/Data:** [VERSÃO E DATA]

#### 1. Objecto

O FarmaStock é uma ferramenta de gestão interna de inventário. Permite registar produtos, lotes, quantidades, movimentos, datas de validade, alertas e relatórios operacionais.

#### 2. Limites do serviço

O FarmaStock não é software de facturação, contabilidade, POS, prescrição, diagnóstico, aconselhamento médico ou dispensa clínica. Não emite documentos fiscais nem substitui as obrigações da farmácia perante a AGT ou as autoridades de saúde.

#### 3. Conta e acesso

Cada utilizador deve ter credenciais próprias. A farmácia é responsável por indicar quem pode aceder e por solicitar a desactivação de contas quando necessário. As credenciais não devem ser partilhadas.

#### 4. Utilização permitida

A aplicação deve ser utilizada apenas para gestão interna e legítima do inventário da farmácia. É proibido introduzir dados de pacientes, receitas médicas, diagnósticos ou outra informação clínica no MVP.

#### 5. Responsabilidade pelos dados

A farmácia é responsável pela exactidão das quantidades, lotes, datas e demais dados que introduz. O sistema facilita a organização e não substitui a verificação física nem o julgamento profissional do farmacêutico.

#### 6. Operações de stock

Cada entrada, saída ou ajuste deve ser registado por um utilizador autorizado. Os movimentos históricos são mantidos para auditoria e não devem ser apagados para ocultar erros. As correcções são feitas por movimentos correctivos.

#### 7. Disponibilidade e manutenção

O fornecedor fará esforços razoáveis para manter o serviço disponível, mas podem ocorrer interrupções por manutenção, falhas de conectividade, indisponibilidade dos fornecedores cloud ou incidentes. As janelas de manutenção programada devem ser comunicadas sempre que possível.

#### 8. Segurança e cópias de segurança

O fornecedor aplica medidas de segurança e executa cópias de segurança nos termos do plano contratado. As cópias reduzem o risco de perda, mas não representam garantia absoluta de recuperação de qualquer operação ou ficheiro.

#### 9. Suporte

O suporte incluído limita-se a dúvidas de utilização e problemas técnicos relacionados com o serviço, dentro do horário e canal indicados no contrato. Novos módulos, integrações e alterações personalizadas são orçamentados à parte.

#### 10. Suspensão

O fornecedor pode suspender o acesso em caso de incumprimento contratual grave, risco de segurança ou utilização ilícita, devendo informar a farmácia e permitir, quando legal e tecnicamente possível, a exportação dos seus dados.

#### 11. Propriedade intelectual

O código, desenho e componentes genéricos da plataforma pertencem ao fornecedor, salvo acordo escrito diferente. Os dados de inventário introduzidos pela farmácia permanecem sob controlo da farmácia. A licença de utilização não transfere a propriedade do código-fonte.

#### 12. Limitação de responsabilidade

O sistema é uma ferramenta de apoio à gestão do inventário. A farmácia deve manter procedimentos de verificação, cópias ou registos complementares adequados à sua actividade. A limitação de responsabilidade não pode excluir direitos ou responsabilidades que a lei não permita excluir. Os limites concretos devem ser revistos por jurista.

#### 13. Cancelamento e saída

A farmácia pode cancelar nos termos do contrato. O fornecedor disponibiliza uma exportação dos dados num formato comum, como CSV/SQL quando adequado, dentro do prazo contratual. Após confirmação da exportação e decorrido o período acordado, os dados serão eliminados dos sistemas activos e dos backups segundo a política de retenção.

#### 14. Lei aplicável e resolução de litígios

Aplicam-se as leis da República de Angola. As partes procurarão resolver divergências por negociação e, não sendo possível, recorrerão aos meios legalmente competentes. O foro deve ser definido no contrato definitivo.

#### 15. Contacto

[EMAIL E MORADA DO FORNECEDOR].

## 12.4. Acordo de Tratamento de Dados (DPA) — minuta

### Acordo de Tratamento de Dados Pessoais

Entre:

**Responsável pelo tratamento:** [NOME LEGAL DA FARMÁCIA], com sede em [MORADA], representada por [NOME/CARGO], adiante designada “Farmácia”.

E

**Subcontratante:** [NOME LEGAL DO FORNECEDOR], com sede em [MORADA], representada por [NOME/CARGO], adiante designada “Fornecedor”.

As partes acordam o seguinte:

#### 1. Objecto e duração

O Fornecedor trata os dados pessoais estritamente necessários para disponibilizar, alojar, manter e prestar suporte à aplicação FarmaStock, durante a vigência do contrato principal e pelo período estritamente necessário à devolução ou eliminação dos dados.

#### 2. Finalidade e instruções

O Fornecedor trata os dados apenas para as finalidades documentadas pela Farmácia e de acordo com as suas instruções. Não utiliza dados pessoais para publicidade, perfilagem, venda de dados, treino de modelos ou finalidades próprias incompatíveis.

#### 3. Categorias de dados e titulares

Categorias previstas: dados de conta dos funcionários (identificador, nome de apresentação e email, quando utilizado), registos de actividade e dados técnicos mínimos. Titulares: trabalhadores e utilizadores autorizados pela Farmácia. Não estão incluídos dados pessoais de pacientes nem dados de saúde.

#### 4. Confidencialidade

O Fornecedor garante que as pessoas autorizadas a tratar dados estão vinculadas a deveres de confidencialidade e recebem apenas o acesso necessário.

#### 5. Segurança

O Fornecedor aplica medidas técnicas e organizativas adequadas, incluindo controlo de acesso, cifragem em trânsito, isolamento dos dados por farmácia, registos de segurança, actualizações e cópias de segurança.

#### 6. Subcontratantes subsequentes

O Fornecedor informa a Farmácia sobre os prestadores técnicos que possam tratar dados, a sua localização e as alterações relevantes. A utilização de subcontratantes subsequentes fica sujeita às formalidades e autorizações legalmente aplicáveis. O Fornecedor assegura contratualmente obrigações de protecção de dados equivalentes.

Lista inicial a confirmar: Supabase, Cloudflare e, caso execute backups, GitHub Actions. Esta lista não é uma declaração de conformidade ou autorização de transferência internacional.

#### 7. Transferências internacionais

Nenhuma transferência internacional de dados pessoais será activada sem confirmação do mecanismo e das formalidades aplicáveis ao abrigo dos artigos 33.º e 34.º da Lei n.º 22/11 e orientação da APD. As partes devem documentar países, destinatários, finalidade e medidas de segurança.

#### 8. Assistência aos titulares

O Fornecedor ajuda a Farmácia, por meios técnicos e dentro do razoável, a responder a pedidos de acesso, rectificação, actualização, cancelamento e oposição.

#### 9. Incidentes

O Fornecedor informa a Farmácia sem atraso injustificado após tomar conhecimento de incidente que afecte dados pessoais, fornecendo a informação necessária para avaliação, contenção, investigação e eventual notificação às autoridades/titulares.

#### 10. Auditoria e demonstração de conformidade

O Fornecedor disponibiliza informação razoável sobre as medidas de segurança e permite verificações documentais proporcionais, respeitando a confidencialidade de outros clientes e a segurança da plataforma.

#### 11. Devolução e eliminação

No fim do contrato, o Fornecedor disponibiliza exportação dos dados e, após instrução da Farmácia e decorrido o prazo acordado, elimina ou devolve os dados pessoais, incluindo cópias, de acordo com a janela de retenção definida. As excepções legais devem ser identificadas.

#### 12. Cooperação com a APD

As partes cooperam no cumprimento de notificações, autorizações e demais formalidades perante a APD. A responsabilidade por cada formalidade deve ser atribuída expressamente após aconselhamento jurídico.

#### 13. Prevalência

Em caso de conflito com os termos gerais, este acordo prevalece no que respeita ao tratamento de dados pessoais.

Assinaturas: [LOCAL, DATA, REPRESENTANTES E ASSINATURAS].

## 12.5. Termos e Condições Comerciais — minuta curta

### Condições Comerciais do Serviço FarmaStock

- **Plano:** FarmaStock — uma farmácia, uma unidade, até cinco utilizadores.
- **Serviço:** gestão de produtos, lotes, entradas, saídas, alertas, relatórios internos e suporte básico.
- **Preço de referência recomendado:** 35.000 Kz por mês para o piloto de lançamento, sujeito à confirmação de custos cloud e dimensão da farmácia.
- **Instalação/configuração:** 50.000 Kz, pagamento único, incluindo configuração inicial, importação assistida de um ficheiro de inventário e formação inicial.
- **Período do piloto:** três meses, com avaliação ao final do segundo mês.
- **Pagamento:** antecipado, até ao dia [DIA] de cada mês, por meio acordado entre as partes.
- **Serviços extra:** novos módulos, integrações, relatórios personalizados, migração complexa ou formação adicional são orçamentados separadamente.
- **Suporte incluído:** suporte remoto em dias úteis, no horário [HORÁRIO], por [CANAL]. Não inclui assistência presencial ilimitada.
- **Actualizações:** correcções, manutenção e melhorias gerais incluídas; funcionalidades específicas são cobradas à parte.
- **Cancelamento:** aviso prévio de 30 dias, salvo acordo diferente.
- **Exportação de dados:** incluída no encerramento do serviço, em formato comum e tecnicamente viável.
- **Facturação do serviço do fornecedor:** o fornecedor deve cumprir as suas próprias obrigações fiscais relativamente ao serviço que presta à farmácia.

Estas condições só entram em vigor depois de completados os dados das partes e da assinatura do contrato definitivo.

---

# 13. Preço recomendado e modelo comercial

## 13.1. Referência de mercado

À data de 10 de Novembro de 2026, foram encontrados preços publicamente anunciados por fornecedores angolanos de software para farmácias e gestão:

- Naqsell apresenta planos anunciados de 15.000 Kz/mês (Básico), 25.000 Kz/mês (Profissional) e 45.000 Kz/mês (Enterprise).
- Kuatelasoft apresenta planos anunciados de 10.000 Kz, 15.000 Kz e 20.000 Kz/mês.

Estes valores são referências de páginas comerciais, não uma auditoria independente aos produtos, ao serviço prestado ou ao número de clientes activos. Alguns planos incluem facturação, POS ou outras funções que não fazem parte do FarmaStock.

## 13.2. Preço que recomendo para este piloto

**Recomendação inicial:**

- **Instalação, configuração e formação:** 50.000 Kz, uma única vez.
- **Subscrição mensal do piloto:** 35.000 Kz/mês durante os primeiros três meses.
- **Preço normal após o piloto:** reavaliar entre 35.000 e 45.000 Kz/mês, conforme o número de utilizadores, suporte, custos cloud, volume de dados e valor comprovado para a farmácia.

O valor de 35.000 Kz é uma proposta de lançamento, não um preço de mercado comprovado. A farmácia deve perceber exactamente o que recebe: alojamento, manutenção, backups, suporte e acesso ao sistema. Se o Supabase Pro, as taxas de pagamento internacional e outros custos fizerem com que o custo directo mensal seja demasiado elevado, o preço deve ser revisto ou a infraestrutura deve ser renegociada antes de assumir o serviço.

À taxa de referência de 913 Kz por USD observada em 9 de Novembro de 2026, o plano Supabase Pro de 25 USD/mês corresponde a cerca de 22.825 Kz, antes de taxas bancárias, conversão e custos adicionais. O plano Pro inclui backups diários do fornecedor com retenção de sete dias. O R2 tem uma franquia mensal de 10 GB-month de armazenamento Standard e operações incluídas dentro dos limites publicados, mas a localização e a transferência internacional têm de ser verificadas juridicamente.

## 13.3. O que inclui a mensalidade

- Acesso ao sistema para uma farmácia e até cinco utilizadores.
- Alojamento cloud contratado para produção.
- Actualizações e correcções gerais.
- Backups automáticos, quando juridicamente autorizados e tecnicamente validados.
- Monitorização básica do funcionamento.
- Suporte remoto em horário acordado.
- Exportação de inventário e movimentos.

Não inclui:

- Novos módulos exclusivos da farmácia.
- Integração com facturação/AGT.
- Equipamentos, computadores ou leitores de códigos de barras.
- Alojamento ou conectividade local da farmácia.
- Formação presencial ilimitada.
- Suporte fora do horário contratado.

## 13.4. Regra de sustentabilidade

Nunca definir o preço apenas pelo custo da base de dados. A mensalidade deve cobrir infraestrutura, cópias de segurança, taxas de pagamento, manutenção, suporte, impostos do fornecedor e uma margem para evolução do produto.

Se a farmácia não aceitar 35.000 Kz/mês, não reduzir o preço sem reduzir claramente o âmbito do serviço ou sem confirmar que os custos estão cobertos. Não prometer suporte 24/7 por uma mensalidade de entrada.

---

# 14. Plano de implementação

## Fase 0 — Preparação jurídica e técnica

Antes de dados reais:

- Confirmar com jurista/contabilista a classificação do serviço e do fornecedor.
- Consultar a APD sobre notificação/autorização para dados de contas de funcionários e registos de actividade.
- Confirmar transferências internacionais de Supabase, Cloudflare e quaisquer outros subcontratantes.
- Avaliar se o fornecedor do SaaS deve registar-se no Centro Nacional de Cibersegurança ao abrigo da Lei n.º 9/26.
- Rever o contrato, DPA e aviso de privacidade.
- Definir contacto para incidentes e pedidos de titulares.
- Confirmar com o farmacêutico responsável quais produtos/categorias entram no inventário piloto.

Até concluir esta fase, utilizar apenas dados fictícios.

## Fase 1 — Construção do MVP

- Criar projecto React + Vite + TypeScript.
- Configurar Tailwind e componentes acessíveis.
- Configurar PWA instalável, sem cache de dados privados.
- Criar projecto Supabase de desenvolvimento.
- Criar migrações SQL para todas as tabelas.
- Implementar autenticação e convites.
- Implementar perfis e permissões.
- Implementar RLS e testes de isolamento.
- Implementar produtos, lotes, fornecedores e movimentos.
- Implementar dashboard, alertas e relatórios.
- Implementar auditoria.
- Criar testes unitários, integração e segurança.

## Fase 2 — Testes e validação

- Testar com dados fictícios.
- Fazer testes de duas contas de farmácias diferentes para comprovar isolamento.
- Testar entradas e saídas simultâneas.
- Testar duplicação de pedidos.
- Testar lotes expirados e bloqueados.
- Testar importação CSV com dados incompletos e duplicados.
- Testar recuperação de backup.
- Fazer demonstração à proprietária e recolher feedback.

## Fase 3 — Piloto controlado

Só depois dos pontos jurídicos aplicáveis estarem resolvidos:

- Criar ambiente de produção separado.
- Subir dados da farmácia com autorização e processo de migração documentado.
- Formar a administradora e funcionários.
- Acompanhar utilização e erros.
- Manter procedimento manual de contingência enquanto a farmácia se adapta.
- Fazer reconciliação física regular entre sistema e prateleiras.
- Rever o piloto ao fim de 30, 60 e 90 dias.

## Fase 4 — Produto comercial

- Rever arquitetura e custos com vários clientes.
- Criar fluxo de onboarding de novas farmácias.
- Automatizar subscrição e estados de pagamento (sem processar pagamentos no MVP).
- Criar painel de suporte com acesso mínimo.
- Formalizar contratos e políticas definitivas.
- Considerar o catálogo público apenas após parecer jurídico específico.

---

# 15. Critérios de aceitação do MVP

O MVP só está pronto para demonstração/piloto se cumprir todos estes critérios:

1. A administradora consegue iniciar sessão e convidar um funcionário.
2. O funcionário só vê a farmácia à qual pertence.
3. É possível criar, editar e desactivar um produto.
4. É possível registar um lote com número e validade.
5. É possível registar uma entrada e confirmar a actualização do stock.
6. É possível registar uma saída sem deixar a quantidade negativa.
7. Um movimento repetido com a mesma chave de idempotência não é duplicado.
8. Um lote expirado/bloqueado não pode ser utilizado numa saída normal.
9. O sistema apresenta alertas de stock baixo e validade próxima.
10. Uma contagem física mostra diferenças e exige aprovação para aplicar ajustes.
11. O histórico mostra quem fez cada operação e quando.
12. É possível exportar o inventário para CSV.
13. RLS impede que um utilizador de uma farmácia consulte os dados de outra.
14. A chave `service_role` não aparece no frontend nem no repositório.
15. A PWA pode ser instalada, mas não apresenta stock em cache como se estivesse actualizado.
16. Os testes automatizados principais passam.
17. Existe documentação de backup, cobertura, restauro e teste de recuperação.
18. Não existe funcionalidade de facturação, POS, pacientes, receitas ou aconselhamento clínico.
19. Os textos legais não são apresentados como aprovados; os campos por preencher estão identificados.
20. A aplicação mostra claramente que é um sistema interno de inventário e não substitui o software fiscal da farmácia.

---

# 16. Estrutura sugerida do repositório

```text
farmastock/
├── public/
│   ├── icons/
│   ├── favicon.svg
│   └── manifest.webmanifest
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── query-client.ts
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   ├── forms/
│   │   └── feedback/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── batches/
│   │   ├── movements/
│   │   ├── stock-counts/
│   │   ├── suppliers/
│   │   ├── alerts/
│   │   ├── reports/
│   │   ├── team/
│   │   └── settings/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── validation/
│   │   ├── dates/
│   │   ├── currency/
│   │   └── permissions/
│   ├── hooks/
│   ├── styles/
│   ├── types/
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── seed.sql
│   └── config.toml
├── scripts/
│   ├── backup/
│   └── restore-test/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── backup.yml
├── docs/
│   ├── architecture.md
│   ├── data-dictionary.md
│   ├── security.md
│   ├── backup-restore.md
│   ├── privacy-and-legal-checklist.md
│   ├── user-guide.md
│   └── pilot-runbook.md
├── tests/
│   ├── unit/
│   ├── integration/
│   └── security/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── vite.config.ts
```

---

# 17. Variáveis de ambiente

Criar `.env.example` com nomes e valores fictícios, nunca credenciais reais:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Segredos apenas em GitHub Secrets ou no serviço de execução do backend/backup, nunca em variáveis `VITE_*`:

```env
SUPABASE_DB_URL=REPLACE_ME
SUPABASE_ACCESS_TOKEN=REPLACE_ME
R2_ACCOUNT_ID=REPLACE_ME
R2_ACCESS_KEY_ID=REPLACE_ME
R2_SECRET_ACCESS_KEY=REPLACE_ME
R2_BUCKET_NAME=REPLACE_ME
BACKUP_ENCRYPTION_RECIPIENT=REPLACE_ME
```

O agente de programação não deve pedir nem inventar credenciais. Deve criar documentação para o utilizador preencher as variáveis manualmente.

---

# 18. Testes obrigatórios

## 18.1. Testes unitários

- Validação de quantidades.
- Cálculo de stock por lote.
- Estado de validade (válido, próximo, expirado).
- Determinação de stock baixo.
- Conversão e apresentação de datas.
- Permissões por perfil no frontend (sem substituir RLS).

## 18.2. Testes de integração

- Criar produto.
- Receber lote.
- Registar saída.
- Corrigir movimento por movimento inverso.
- Efectuar contagem física.
- Exportar CSV.
- Desactivar funcionário.

## 18.3. Testes de segurança multi-tenant

Criar duas farmácias fictícias, A e B, e dois utilizadores independentes.

Verificar que:

- O utilizador A não lê produtos, lotes, fornecedores, movimentos ou logs da farmácia B.
- O utilizador A não insere registos com `pharmacy_id` da farmácia B.
- O utilizador A não altera nem apaga registos da farmácia B.
- Um utilizador sem associação não acede a qualquer dado operacional.
- O perfil `viewer` não consegue alterar stock.
- O perfil `stock_operator` não consegue gerir contas ou permissões.
- O cliente não consegue executar funções administrativas.

Estes testes são obrigatórios antes de qualquer demonstração com dados reais.

---

# 19. Prompt de execução para Claude Code

Copiar o texto abaixo e usá-lo no Claude Code, com o modelo de programação disponível. O agente deve ler este documento inteiro antes de começar.

```text
Actua como engenheiro de software sénior, arquitecto de aplicações web e especialista em PostgreSQL/Supabase. Vais implementar o projecto descrito neste documento: FARMASTOCK — Arquitectura e especificação completa do projecto-piloto.

LÊ O DOCUMENTO INTEIRO ANTES DE ESCREVER CÓDIGO. Não ignores as secções legais, de segurança, multi-tenancy, backups ou critérios de aceitação.

OBJECTIVO
Construir uma PWA de gestão interna de inventário para uma farmácia em Angola. A primeira versão gere produtos, lotes, quantidades, entradas, saídas, ajustes, contagens, alertas de validade, stock mínimo, fornecedores e relatórios internos.

STACK OBRIGATÓRIA
- React + TypeScript + Vite.
- Tailwind CSS e componentes acessíveis.
- React Router.
- TanStack Query.
- React Hook Form + Zod.
- Supabase: PostgreSQL, Auth, RLS e RPC; Edge Functions apenas quando necessário.
- vite-plugin-pwa.
- Cloudflare Pages como destino de frontend estático.
- GitHub Actions para CI. O workflow de backup deve ficar desactivado ou em modo de teste até serem preenchidas as credenciais e validada juridicamente a transferência internacional.

REGRAS ABSOLUTAS
1. Não implementar facturação, recibos, POS, caixa, impostos, SAFT ou AGT.
2. Não implementar pacientes, receitas, diagnósticos, alergias, histórico de saúde ou aconselhamento médico.
3. Não implementar catálogo público de medicamentos nesta versão.
4. Não introduzir dados reais nem credenciais reais no repositório.
5. Não colocar SUPABASE_SERVICE_ROLE_KEY no frontend ou em qualquer variável VITE_*.
6. Todas as tabelas da aplicação têm RLS e isolamento por pharmacy_id.
7. Todas as operações de stock são transaccionais, atómicas e idempotentes.
8. Os movimentos históricos são imutáveis; corrigir através de movimentos inversos.
9. A PWA é instalável, mas não guarda stock privado em cache e não permite escrita offline.
10. Não afirmar que o produto está legalmente certificado ou que está conforme a AGT.
11. Não apresentar os documentos de privacidade como parecer jurídico ou textos aprovados.
12. Não fazer deploy para produção, não ligar a contas reais e não importar inventário real sem instrução explícita do utilizador.

PROCESSO DE TRABALHO
FASE A — AUDITORIA E PLANO
- Inspecciona o repositório antes de fazer alterações.
- Se estiver vazio, cria a estrutura de projecto indicada neste documento.
- Cria `docs/implementation-plan.md` com fases e decisões técnicas.
- Identifica riscos e dúvidas, mas não bloqueies o trabalho por detalhes não essenciais. Usa as decisões deste documento como padrão.

FASE B — FUNDAÇÃO
- Inicializa React + Vite + TypeScript.
- Instala e configura as dependências necessárias, escolhendo versões estáveis compatíveis.
- Configura lint, format, typecheck e testes.
- Cria cliente Supabase seguro e `.env.example`.
- Cria o layout responsivo em português de Portugal.
- Configura PWA com cache apenas de assets estáticos.

FASE C — BASE DE DADOS
- Cria migrações SQL versionadas para as tabelas e enums descritos.
- Cria índices, constraints, views e funções RPC necessárias.
- Liga RLS a todas as tabelas.
- Implementa helpers seguros para verificar membership e role.
- Revê cuidadosamente qualquer função SECURITY DEFINER.
- Cria `seed.sql` apenas com dados fictícios.
- Documenta o modelo em `docs/data-dictionary.md`.

FASE D — FUNCIONALIDADES
Implementa por esta ordem:
1. Login, recuperação de palavra-passe e convites.
2. Gestão de farmácia e membros.
3. Dashboard.
4. Produtos.
5. Lotes.
6. Entradas e saídas com RPC transaccional e idempotência.
7. Ajustes e movimentos correctivos.
8. Contagens de inventário.
9. Fornecedores.
10. Alertas de stock baixo e validade.
11. Relatórios e exportação CSV.
12. Auditoria e definições.

FASE E — SEGURANÇA E TESTES
- Cria testes unitários, integração e RLS.
- Testa duas farmácias fictícias e confirma que os dados nunca se cruzam.
- Testa concorrência em saídas do mesmo lote.
- Testa duplo clique e repetição de pedidos.
- Testa lote expirado, bloqueado e stock negativo.
- Testa cada perfil de utilizador.
- Confirma que nenhuma chave secreta está no bundle ou no Git.
- Executa typecheck, lint, testes e build. Corrige os erros.

FASE F — BACKUP E RESTAURO
- Cria scripts de backup e restore de teste e documenta a cobertura real.
- Tem em atenção que `supabase db dump` exclui por defeito esquemas geridos como auth e storage e que os objectos do Storage não são incluídos nos backups da base de dados.
- Não afirmar que o backup cobre tudo sem testar.
- Criar workflow GitHub Actions com agendamento, mas deixar o envio para armazenamento externo desactivado até o utilizador confirmar a autorização jurídica e preencher os secrets.
- Encriptar antes do upload, calcular SHA-256, guardar manifest e testar restauro numa base de dados separada.
- Nunca expor a chave privada de desencriptação.

FASE G — DOCUMENTAÇÃO
Criar e manter actualizados:
- README.md com instalação e desenvolvimento local.
- docs/architecture.md.
- docs/data-dictionary.md.
- docs/security.md.
- docs/backup-restore.md.
- docs/privacy-and-legal-checklist.md.
- docs/user-guide.md.
- docs/pilot-runbook.md.
- `.env.example`.

DESIGN E EXPERIÊNCIA DE UTILIZAÇÃO
- Interface profissional, limpa e simples, adequada a uma farmácia.
- Prioridade desktop/tablet, mas responsiva para telemóvel.
- Linguagem simples em português de Portugal.
- Datas dd/MM/yyyy, hora 24h, timezone Africa/Luanda e moeda AOA.
- Não utilizar emojis.
- Criar estados vazios, carregamento, erro, confirmação e sucesso.
- Mostrar claramente quando não há ligação à Internet.
- Não criar gráficos decorativos; privilegiar acções e alertas úteis.

ENTREGA
No final:
- Apresenta resumo do que foi implementado.
- Lista comandos para instalar, executar, testar e fazer build.
- Lista migrações criadas.
- Lista variáveis de ambiente necessárias.
- Indica o que ainda não está implementado.
- Indica todas as verificações de segurança executadas e os respectivos resultados.
- Identifica os passos legais que continuam pendentes.
- Não declares o sistema pronto para dados reais se as verificações jurídicas, de segurança e de recuperação ainda não estiverem concluídas.

Começa pela FASE A e avança fase a fase. Não peças ao utilizador informações que possam ser substituídas por placeholders nesta fase. Não inventes credenciais ou dados reais.
```

---

# 20. Lista de verificação antes de utilizar dados reais

## Jurídico e administrativo

- [ ] Confirmar a entidade legal que vai prestar o serviço e o seu enquadramento fiscal.
- [ ] Confirmar a notificação/autorização aplicável perante a APD.
- [ ] Confirmar o papel da farmácia e do fornecedor no tratamento de dados.
- [ ] Rever e assinar contrato de prestação de serviços.
- [ ] Rever e assinar DPA/acordo de subcontratação.
- [ ] Preencher e publicar o aviso/política de privacidade.
- [ ] Confirmar a necessidade de consentimento ou outra base legal para cada tratamento.
- [ ] Confirmar transferências internacionais e regiões dos fornecedores.
- [ ] Avaliar registo e obrigações do prestador de serviços digitais ao abrigo da Lei n.º 9/26.
- [ ] Confirmar junto do farmacêutico responsável as categorias de medicamentos incluídas.
- [ ] Não lançar o catálogo público sem parecer sobre a Lei n.º 9/17 e regras sanitárias aplicáveis.

## Técnico e operacional

- [ ] Ambiente de produção separado do desenvolvimento.
- [ ] RLS e testes multi-tenant aprovados.
- [ ] MFA na conta administradora.
- [ ] Secrets guardados de forma segura.
- [ ] Backup encriptado configurado e autorizado.
- [ ] Teste real de restauro concluído.
- [ ] Plano de resposta a incidentes documentado.
- [ ] Funcionários formados.
- [ ] Dados de inventário conferidos fisicamente.
- [ ] Procedimento manual de contingência definido para falha de Internet.
- [ ] Plano de exportação e saída do serviço testado.

---

# 21. Fontes legais e técnicas

As referências seguintes serviram de base à especificação. Confirmar sempre a versão oficial e a regulamentação complementar antes da contratação ou entrada em produção.

## Legislação angolana

1. **Lei n.º 22/11, de 17 de Junho — Lei da Protecção de Dados Pessoais**  
   Diário da República / APD: https://apd.ao/fotos/frontend_1/editor2/110617_lei_22-11_de_17_junho-proteccao_dados_pessoais.pdf  
   Texto pesquisável: https://lex.ao/docs/assembleia-nacional/2011/lei-n-o-22-11-de-17-de-junho/

2. **Lei n.º 9/26, de 28 de Setembro — Lei da Cibersegurança**  
   Texto informativo transcrito do Diário da República: https://leiciber.ao/lei/texto-integral/  
   Confirmar o texto oficial no Diário da República: I Série, n.º 183, de 28 de Setembro de 2026.

3. **Lei n.º 9/17, de 13 de Março — Lei Geral da Publicidade**  
   Texto: https://lex.ao/docs/assembleia-nacional/2017/lei-n-o-9-17-de-13-de-marco/

4. **Agência de Protecção de Dados — Direitos dos cidadãos**  
   https://apd.ao/ao/direitos-do-cidadao/

5. **Agência de Protecção de Dados — Legalização do tratamento de dados**  
   https://apd.ao/ao/catalogo/formularios-apd/legalizacao-do-tratamento-de-dados/

6. **ARMED — Registo de medicamentos**  
   https://armed.gov.ao/informacoes?menu=INFORMA%C3%87%C3%95ES&opcao=Pedidos+de+AIM%2FRegisto+de+Medicamentos

## Documentação técnica

7. **Supabase — Database Backups**  
   https://supabase.com/docs/guides/platform/backups

8. **Supabase — CLI `db dump`**  
   https://supabase.com/docs/reference/cli/supabase-db-dump

9. **Supabase — Backup and Restore using the CLI**  
   https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

10. **Supabase — Billing**  
    https://supabase.com/docs/guides/platform/billing-on-supabase

11. **Supabase — RLS**  
    https://supabase.com/docs/guides/database/postgres/row-level-security

12. **Cloudflare R2 — Pricing**  
    https://developers.cloudflare.com/r2/pricing/

13. **Cloudflare R2 — Data location**  
    https://developers.cloudflare.com/r2/reference/data-location/

14. **Vite PWA — Plugin**  
    https://vite-pwa-org.netlify.app/

## Referências comerciais de preços consultadas

15. **Naqsell — Software para farmácias**  
    https://naqsell.co.ao/

16. **Kuatelasoft — Gestão de farmácias**  
    https://www.kuatelasoft.co.ao/farmacias/

17. **Referência cambial USD/AOA (9 de Novembro de 2026)**  
    https://finda.ao/cambio/usd-aoa/

---

# 22. Decisão final do projecto

A primeira versão do FarmaStock deve ser um **sistema interno de gestão de inventário**, não um sistema de facturação e não um portal público de medicamentos.

A prioridade é que o registo de stock seja correcto, rastreável, seguro e fácil de utilizar. A tecnologia escolhida deve reduzir custos e permitir evoluir para várias farmácias sem criar uma infraestrutura desnecessariamente complexa.

**Stack final:** React + TypeScript + Vite + PWA + Supabase/PostgreSQL/Auth/RLS + Cloudflare Pages. Backups externos cifrados em Cloudflare R2, automatizados com GitHub Actions, apenas depois de resolvidas as questões de transferência internacional.

**Preço de lançamento sugerido:** 50.000 Kz de configuração e formação + 35.000 Kz/mês durante o piloto de três meses. Reavaliar para 35.000–45.000 Kz/mês depois de medir custos e utilização.

**Condição de entrada em produção:** parecer jurídico e formalidades aplicáveis perante a APD/Centro Nacional de Cibersegurança confirmados, fornecedores cloud e transferências documentados, contratos assinados, RLS testado e restauro de backup demonstrado.
