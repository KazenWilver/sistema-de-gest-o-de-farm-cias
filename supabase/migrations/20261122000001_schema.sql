-- FarmaStock — esquema base (tabelas, enums, constraints, índices)
-- Todas as tabelas de negócio têm pharmacy_id. Sem dados de pacientes.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'manager', 'stock_operator', 'viewer');

create type public.batch_status as enum ('active', 'blocked', 'expired', 'depleted');

create type public.movement_type as enum (
  'receipt',
  'issue',
  'adjustment_in',
  'adjustment_out',
  'return_to_supplier',
  'internal_transfer_in',
  'internal_transfer_out',
  'expired_disposal',
  'damage'
);

create type public.stock_count_status as enum ('draft', 'in_progress', 'review', 'completed', 'cancelled');

create type public.backup_status as enum ('started', 'success', 'failed');

-- ---------------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- pharmacies
-- ---------------------------------------------------------------------------
create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  address text check (char_length(address) <= 300),
  phone text check (char_length(phone) <= 40),
  timezone text not null default 'Africa/Luanda',
  currency text not null default 'AOA' check (currency ~ '^[A-Z]{3}$'),
  expiry_alert_days integer[] not null default '{90,60,30}'
    check (cardinality(expiry_alert_days) between 1 and 5 and 0 < all (expiry_alert_days) and 731 > all (expiry_alert_days)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pharmacies_updated_at before update on public.pharmacies
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_profiles (id = auth.users.id). Email e credenciais ficam no Supabase Auth.
-- ---------------------------------------------------------------------------
create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- pharmacy_members
-- ---------------------------------------------------------------------------
create table public.pharmacy_members (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  user_id uuid not null references public.user_profiles (id) on delete restrict,
  role public.member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pharmacy_members_unique unique (pharmacy_id, user_id)
);

create index pharmacy_members_user_idx on public.pharmacy_members (user_id) where is_active;

create trigger pharmacy_members_updated_at before update on public.pharmacy_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  active_ingredient text check (char_length(active_ingredient) <= 200),
  brand text check (char_length(brand) <= 120),
  strength text check (char_length(strength) <= 80),
  dosage_form text check (char_length(dosage_form) <= 80),
  presentation text check (char_length(presentation) <= 160),
  unit_name text not null check (char_length(btrim(unit_name)) between 1 and 40),
  barcode text check (barcode ~ '^[0-9A-Za-z\-]{4,64}$'),
  internal_code text check (char_length(btrim(internal_code)) between 1 and 64),
  category text check (char_length(category) <= 80),
  minimum_stock numeric(14, 3) not null default 0 check (minimum_stock >= 0),
  notes text check (char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Necessário para FKs compostas que garantem a mesma farmácia.
  constraint products_pharmacy_id_id_unique unique (pharmacy_id, id)
);

create unique index products_barcode_unique on public.products (pharmacy_id, barcode) where barcode is not null;
create unique index products_internal_code_unique on public.products (pharmacy_id, lower(internal_code)) where internal_code is not null;
create index products_name_idx on public.products (pharmacy_id, lower(name));
create index products_active_ingredient_idx on public.products (pharmacy_id, lower(active_ingredient));
create index products_category_idx on public.products (pharmacy_id, category);

create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  phone text check (char_length(phone) <= 40),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 160),
  notes text check (char_length(notes) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_pharmacy_id_id_unique unique (pharmacy_id, id)
);

create index suppliers_name_idx on public.suppliers (pharmacy_id, lower(name));

create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- stock_batches
-- available_quantity é a ÚNICA fonte da quantidade disponível.
-- ---------------------------------------------------------------------------
create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  product_id uuid not null,
  supplier_id uuid,
  lot_number text not null check (char_length(btrim(lot_number)) between 1 and 64),
  expiry_date date,
  received_quantity numeric(14, 3) not null check (received_quantity > 0),
  available_quantity numeric(14, 3) not null check (available_quantity >= 0),
  purchase_unit_cost numeric(14, 2) check (purchase_unit_cost >= 0),
  reference_sale_price numeric(14, 2) check (reference_sale_price >= 0),
  received_at timestamptz not null default now(),
  status public.batch_status not null default 'active',
  status_reason text check (char_length(status_reason) <= 300),
  created_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_batches_pharmacy_id_id_unique unique (pharmacy_id, id),
  constraint stock_batches_product_fk foreign key (pharmacy_id, product_id)
    references public.products (pharmacy_id, id) on delete restrict,
  constraint stock_batches_supplier_fk foreign key (pharmacy_id, supplier_id)
    references public.suppliers (pharmacy_id, id) on delete restrict,
  constraint stock_batches_lot_unique unique (pharmacy_id, product_id, lot_number)
);

create index stock_batches_product_idx on public.stock_batches (pharmacy_id, product_id);
create index stock_batches_expiry_idx on public.stock_batches (pharmacy_id, expiry_date) where available_quantity > 0;
create index stock_batches_lot_idx on public.stock_batches (pharmacy_id, lower(lot_number));

create trigger stock_batches_updated_at before update on public.stock_batches
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- stock_movements — histórico imutável
-- ---------------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  product_id uuid not null,
  batch_id uuid,
  movement_type public.movement_type not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  quantity_before numeric(14, 3) not null check (quantity_before >= 0),
  quantity_after numeric(14, 3) not null check (quantity_after >= 0),
  reason text check (char_length(reason) <= 300),
  reference text check (char_length(reference) <= 120),
  reverses_movement_id uuid references public.stock_movements (id) on delete restrict,
  stock_count_id uuid,
  created_by uuid not null references public.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  constraint stock_movements_product_fk foreign key (pharmacy_id, product_id)
    references public.products (pharmacy_id, id) on delete restrict,
  constraint stock_movements_batch_fk foreign key (pharmacy_id, batch_id)
    references public.stock_batches (pharmacy_id, id) on delete restrict,
  constraint stock_movements_idempotency unique (pharmacy_id, idempotency_key),
  constraint stock_movements_reverses_unique unique (reverses_movement_id),
  constraint stock_movements_reason_required check (
    movement_type in ('receipt', 'issue', 'internal_transfer_in', 'internal_transfer_out')
    or char_length(btrim(coalesce(reason, ''))) >= 3
  ),
  constraint stock_movements_balance check (
    case
      when movement_type in ('receipt', 'adjustment_in', 'internal_transfer_in')
        then quantity_after = quantity_before + quantity
      else quantity_after = quantity_before - quantity
    end
  )
);

create index stock_movements_product_idx on public.stock_movements (pharmacy_id, product_id, created_at desc);
create index stock_movements_batch_idx on public.stock_movements (pharmacy_id, batch_id, created_at desc);
create index stock_movements_created_idx on public.stock_movements (pharmacy_id, created_at desc);

create or replace function private.forbid_movement_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Os movimentos de stock são imutáveis. Registe um movimento correctivo.'
    using errcode = 'P0001';
end;
$$;

create trigger stock_movements_immutable
  before update or delete on public.stock_movements
  for each row execute function private.forbid_movement_changes();

-- ---------------------------------------------------------------------------
-- stock_counts / stock_count_items
-- ---------------------------------------------------------------------------
create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  status public.stock_count_status not null default 'in_progress',
  started_by uuid not null references public.user_profiles (id) on delete restrict,
  approved_by uuid references public.user_profiles (id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text check (char_length(notes) <= 500),
  constraint stock_counts_pharmacy_id_id_unique unique (pharmacy_id, id)
);

create index stock_counts_pharmacy_idx on public.stock_counts (pharmacy_id, started_at desc);

alter table public.stock_movements
  add constraint stock_movements_count_fk foreign key (pharmacy_id, stock_count_id)
    references public.stock_counts (pharmacy_id, id) on delete restrict;

create table public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  stock_count_id uuid not null,
  product_id uuid not null,
  batch_id uuid,
  expected_quantity numeric(14, 3) not null check (expected_quantity >= 0),
  counted_quantity numeric(14, 3) check (counted_quantity >= 0),
  difference numeric(14, 3) generated always as (counted_quantity - expected_quantity) stored,
  counted_by uuid references public.user_profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_count_items_count_fk foreign key (pharmacy_id, stock_count_id)
    references public.stock_counts (pharmacy_id, id) on delete cascade,
  constraint stock_count_items_product_fk foreign key (pharmacy_id, product_id)
    references public.products (pharmacy_id, id) on delete restrict,
  constraint stock_count_items_batch_fk foreign key (pharmacy_id, batch_id)
    references public.stock_batches (pharmacy_id, id) on delete restrict,
  constraint stock_count_items_unique unique (stock_count_id, batch_id)
);

create index stock_count_items_count_idx on public.stock_count_items (stock_count_id);

create trigger stock_count_items_updated_at before update on public.stock_count_items
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete restrict,
  actor_user_id uuid references public.user_profiles (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity_type text not null check (char_length(entity_type) <= 60),
  entity_id text check (char_length(entity_id) <= 80),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now()
);

create index audit_logs_pharmacy_idx on public.audit_logs (pharmacy_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (pharmacy_id, entity_type, entity_id);

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function private.forbid_movement_changes();

-- ---------------------------------------------------------------------------
-- privacy_acknowledgements — confirmação de leitura (NÃO é consentimento)
-- ---------------------------------------------------------------------------
create table public.privacy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  notice_version text not null check (char_length(notice_version) between 1 and 20),
  acknowledged_at timestamptz not null default now(),
  constraint privacy_acknowledgements_unique unique (user_id, notice_version)
);

-- ---------------------------------------------------------------------------
-- backup_runs — metadados técnicos, sem segredos
-- ---------------------------------------------------------------------------
create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  status public.backup_status not null default 'started',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  file_name text check (char_length(file_name) <= 200),
  file_size_bytes bigint check (file_size_bytes >= 0),
  sha256_checksum text check (sha256_checksum ~ '^[0-9a-f]{64}$'),
  destination text check (char_length(destination) <= 200 and destination !~* '(key|token|secret|signature)='),
  error_summary text check (char_length(error_summary) <= 500)
);

create index backup_runs_started_idx on public.backup_runs (started_at desc);
