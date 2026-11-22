# Dicionário de dados

Todas as tabelas estão no schema `public`, têm RLS activo e (salvo `user_profiles`, `privacy_acknowledgements` e `backup_runs`) uma coluna `pharmacy_id`. Quantidades são `numeric(14,3)`; valores em Kz `numeric(14,2)`. Instantes `timestamptz` (UTC); datas de calendário `date`.

**Dados pessoais:** só nome e email de utilizadores (em `auth.users`/`user_profiles`), e contactos de fornecedores (que podem ser pessoas). Não existem dados de pacientes, receitas ou saúde.

## Tipos

| Tipo                 | Valores                                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `member_role`        | `owner` (administradora), `manager` (farmacêutico/gestor), `stock_operator`, `viewer`                                                                      |
| `batch_status`       | `active`, `blocked`, `expired`\*, `depleted`                                                                                                               |
| `movement_type`      | `receipt`, `issue`, `adjustment_in`, `adjustment_out`, `return_to_supplier`, `internal_transfer_in`, `internal_transfer_out`, `expired_disposal`, `damage` |
| `stock_count_status` | `draft`, `in_progress`, `review`, `completed`, `cancelled`                                                                                                 |
| `backup_status`      | `started`, `success`, `failed`                                                                                                                             |

\* O estado "expirado" apresentado é calculado pela data (`batch_overview.effective_status`), não guardado.

## Tabelas

### `pharmacies`

Farmácia (inquilino). `name`, `address`, `phone`, `timezone` (Africa/Luanda), `currency` (AOA), `expiry_alert_days int[]` (janelas de alerta, defeito `{90,60,30}`), `is_active`. Editável só pela owner.

### `user_profiles`

Perfil 1:1 com `auth.users` (criado por trigger). `display_name`. Email fica no Supabase Auth.

### `pharmacy_members`

Ligação utilizador ↔ farmácia. `role`, `is_active`. Único por `(pharmacy_id, user_id)`. Alterado só por RPC/Edge Function.

### `products`

Catálogo interno da farmácia. `name`, `active_ingredient`, `brand`, `strength`, `dosage_form`, `presentation`, `unit_name` (unidade de contagem), `barcode` (único por farmácia), `internal_code` (único por farmácia, sem distinguir maiúsculas), `category`, `minimum_stock`, `notes`, `is_active`. Sem preço próprio.

### `suppliers`

`name`, `phone`, `email`, `notes`, `is_active`.

### `stock_batches`

Lote de um produto. `lot_number` (único por produto), `expiry_date` (pode ser nula só para produtos sem validade), `received_quantity`, `available_quantity` (≥ 0, **só alterada por RPC**), `purchase_unit_cost`, `reference_sale_price` (referência interna, não é preço de venda fiscal), `supplier_id`, `status`, `status_reason`.

### `stock_movements` (imutável)

Histórico de cada alteração de stock. `movement_type`, `quantity` (> 0), `quantity_before`, `quantity_after` (verificados por `CHECK` de saldo), `reason` (obrigatório salvo entradas, saídas normais e transferências), `reference`, `reverses_movement_id` (correcção; único), `stock_count_id`, `created_by`, `created_at`, `idempotency_key` (única por farmácia). `UPDATE`/`DELETE` bloqueados por trigger.

### `stock_counts` / `stock_count_items`

Contagem física. Itens com `expected_quantity` (fotografia no início), `counted_quantity`, `difference` (coluna gerada), `counted_by`. A aprovação cria movimentos `adjustment_in/out` ligados pela `stock_count_id`.

### `audit_logs` (imutável)

`actor_user_id`, `action`, `entity_type`, `entity_id`, `metadata` (≤ 4 KB: nomes dos campos alterados e valores de campos críticos; sem texto livre). Escrita só por triggers/RPC.

### `privacy_acknowledgements`

Registo de que o utilizador leu o aviso de privacidade: `user_id`, `notice_version`, `acknowledged_at`. Não é consentimento.

### `backup_runs`

Metadados técnicos dos backups: `status`, `started_at`, `finished_at`, `file_name`, `file_size_bytes`, `sha256_checksum`, `destination` (sem credenciais: `CHECK` recusa `key=`, `token=`…), `error_summary`. Visível só à owner.

## Views (`security_invoker`)

| View                | Conteúdo                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `batch_overview`    | Lotes + produto + fornecedor, `effective_status`, `days_to_expiry`, `usable`             |
| `product_stock`     | Totais por produto (só lotes utilizáveis contam como disponíveis), estado face ao mínimo |
| `movement_overview` | Movimentos com produto, lote e nome de quem registou                                     |
| `movement_summary`  | Totais por tipo de movimento num intervalo (relatórios)                                  |
