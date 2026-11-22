-- FarmaStock — views e operações transaccionais de stock (RPC).
-- Cada operação: valida perfil com auth.uid(), bloqueia a chave de idempotência,
-- bloqueia o lote (FOR UPDATE), altera a quantidade e cria o movimento na mesma transacção.

-- ---------------------------------------------------------------------------
-- Views (security_invoker: respeitam o RLS de quem consulta)
-- ---------------------------------------------------------------------------
create view public.batch_overview
with (security_invoker = true)
as
select
  b.id,
  b.pharmacy_id,
  b.product_id,
  b.supplier_id,
  b.lot_number,
  b.expiry_date,
  b.received_quantity,
  b.available_quantity,
  b.purchase_unit_cost,
  b.reference_sale_price,
  b.received_at,
  b.status,
  b.status_reason,
  b.created_by,
  b.created_at,
  b.updated_at,
  p.name as product_name,
  p.strength as product_strength,
  p.presentation as product_presentation,
  p.unit_name,
  p.is_active as product_is_active,
  s.name as supplier_name,
  (b.expiry_date - t.today) as days_to_expiry,
  case
    when b.status = 'blocked' then 'blocked'
    when b.expiry_date is not null and b.expiry_date < t.today then 'expired'
    when b.available_quantity = 0 then 'depleted'
    else 'active'
  end as effective_status
from public.stock_batches b
join public.products p on p.id = b.product_id
join public.pharmacies ph on ph.id = b.pharmacy_id
left join public.suppliers s on s.id = b.supplier_id
cross join lateral (select (now() at time zone ph.timezone)::date as today) t;

create view public.product_stock
with (security_invoker = true)
as
with batch_state as (
  select
    b.product_id,
    b.available_quantity,
    b.expiry_date,
    b.lot_number,
    b.supplier_id,
    (b.status <> 'blocked' and (b.expiry_date is null or b.expiry_date >= t.today)) as usable
  from public.stock_batches b
  join public.pharmacies ph on ph.id = b.pharmacy_id
  cross join lateral (select (now() at time zone ph.timezone)::date as today) t
)
select
  p.id,
  p.pharmacy_id,
  p.name,
  p.active_ingredient,
  p.brand,
  p.strength,
  p.dosage_form,
  p.presentation,
  p.unit_name,
  p.barcode,
  p.internal_code,
  p.category,
  p.minimum_stock,
  p.is_active,
  p.created_at,
  p.updated_at,
  coalesce(sum(bs.available_quantity) filter (where bs.usable), 0)::numeric(14, 3) as available_quantity,
  coalesce(sum(bs.available_quantity) filter (where not bs.usable), 0)::numeric(14, 3) as unusable_quantity,
  min(bs.expiry_date) filter (where bs.usable and bs.available_quantity > 0) as next_expiry_date,
  count(*) filter (where bs.usable and bs.available_quantity > 0) as active_batch_count,
  coalesce(string_agg(bs.lot_number, ' '), '') as lot_numbers,
  coalesce(array_agg(distinct bs.supplier_id) filter (where bs.supplier_id is not null), '{}') as supplier_ids,
  case
    when coalesce(sum(bs.available_quantity) filter (where bs.usable), 0) = 0 then 'out'
    when p.minimum_stock > 0
      and coalesce(sum(bs.available_quantity) filter (where bs.usable), 0) <= p.minimum_stock then 'low'
    else 'ok'
  end as stock_state
from public.products p
left join batch_state bs on bs.product_id = p.id
group by p.id;

create view public.movement_overview
with (security_invoker = true)
as
select
  m.id,
  m.pharmacy_id,
  m.product_id,
  m.batch_id,
  m.movement_type,
  m.quantity,
  m.quantity_before,
  m.quantity_after,
  m.reason,
  m.reference,
  m.reverses_movement_id,
  m.stock_count_id,
  m.created_by,
  m.created_at,
  p.name as product_name,
  p.unit_name,
  b.lot_number,
  u.display_name as created_by_name,
  exists (select 1 from public.stock_movements r where r.reverses_movement_id = m.id) as is_reversed
from public.stock_movements m
join public.products p on p.id = m.product_id
left join public.stock_batches b on b.id = m.batch_id
left join public.user_profiles u on u.id = m.created_by;

grant select on public.batch_overview, public.product_stock, public.movement_overview to authenticated;

-- Resumo de movimentos por período (respeita RLS: SECURITY INVOKER).
create or replace function public.movement_summary(p_pharmacy_id uuid, p_from date, p_to date)
returns table (movement_type public.movement_type, movement_count bigint, total_quantity numeric, product_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.movement_type, count(*), sum(m.quantity), count(distinct m.product_id)
  from public.stock_movements m
  join public.pharmacies ph on ph.id = m.pharmacy_id
  where m.pharmacy_id = p_pharmacy_id
    and (m.created_at at time zone ph.timezone)::date between p_from and p_to
  group by m.movement_type
  order by m.movement_type;
$$;

-- ---------------------------------------------------------------------------
-- Auxiliares internos
-- ---------------------------------------------------------------------------
create or replace function private.lock_idempotency(p_pharmacy_id uuid, p_key text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_key is null or char_length(p_key) < 8 or char_length(p_key) > 120 then
    raise exception 'Pedido inválido: falta a chave de idempotência.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_pharmacy_id::text || ':' || p_key, 0));
end;
$$;

create or replace function private.existing_movement(p_pharmacy_id uuid, p_key text)
returns public.stock_movements
language sql
stable
set search_path = ''
as $$
  select * from public.stock_movements where pharmacy_id = p_pharmacy_id and idempotency_key = p_key;
$$;

create or replace function private.fmt_qty(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(trailing '.' from trim(trailing '0' from to_char(p, 'FM999999999990.000')));
$$;

-- ---------------------------------------------------------------------------
-- Entrada de stock
-- ---------------------------------------------------------------------------
create or replace function public.receive_stock(
  p_pharmacy_id uuid,
  p_product_id uuid,
  p_lot_number text,
  p_expiry_date date,
  p_quantity numeric,
  p_idempotency_key text,
  p_supplier_id uuid default null,
  p_purchase_unit_cost numeric default null,
  p_reference_sale_price numeric default null,
  p_reference text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager,stock_operator}');
  v_existing public.stock_movements;
  v_movement public.stock_movements;
  v_batch public.stock_batches;
  v_lot text := upper(btrim(coalesce(p_lot_number, '')));
  v_before numeric := 0;
begin
  perform private.lock_idempotency(p_pharmacy_id, p_idempotency_key);
  v_existing := private.existing_movement(p_pharmacy_id, p_idempotency_key);
  if v_existing.id is not null then
    if v_existing.movement_type <> 'receipt' or v_existing.product_id <> p_product_id then
      raise exception 'Chave de idempotência já utilizada noutra operação.' using errcode = 'P0001';
    end if;
    return v_existing;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade recebida tem de ser maior que zero.' using errcode = 'P0001';
  end if;
  if v_lot = '' then
    raise exception 'Indique o número do lote.' using errcode = 'P0001';
  end if;
  if p_expiry_date is not null and p_expiry_date < private.pharmacy_today(p_pharmacy_id) then
    raise exception 'A data de validade indicada já passou. Não é possível dar entrada de um lote expirado.'
      using errcode = 'P0001';
  end if;
  if coalesce(p_purchase_unit_cost, 0) < 0 or coalesce(p_reference_sale_price, 0) < 0 then
    raise exception 'Os valores não podem ser negativos.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and pharmacy_id = p_pharmacy_id and is_active
  ) then
    raise exception 'Produto não encontrado ou inactivo.' using errcode = 'P0001';
  end if;

  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and pharmacy_id = p_pharmacy_id and is_active
  ) then
    raise exception 'Fornecedor não encontrado ou inactivo.' using errcode = 'P0001';
  end if;

  select * into v_batch
  from public.stock_batches
  where pharmacy_id = p_pharmacy_id and product_id = p_product_id and lot_number = v_lot
  for update;

  if v_batch.id is not null then
    if v_batch.expiry_date is distinct from p_expiry_date then
      raise exception 'O lote % já existe com outra data de validade (%). Confirme os dados.',
        v_lot, coalesce(to_char(v_batch.expiry_date, 'DD/MM/YYYY'), 'sem validade')
        using errcode = 'P0001';
    end if;
    if v_batch.status = 'blocked' then
      raise exception 'O lote % está bloqueado. Desbloqueie-o antes de registar novas entradas.', v_lot
        using errcode = 'P0001';
    end if;
    v_before := v_batch.available_quantity;
    update public.stock_batches
    set received_quantity = received_quantity + p_quantity,
        available_quantity = available_quantity + p_quantity,
        supplier_id = coalesce(p_supplier_id, supplier_id),
        purchase_unit_cost = coalesce(p_purchase_unit_cost, purchase_unit_cost),
        reference_sale_price = coalesce(p_reference_sale_price, reference_sale_price)
    where id = v_batch.id
    returning * into v_batch;
  else
    insert into public.stock_batches (
      pharmacy_id, product_id, supplier_id, lot_number, expiry_date,
      received_quantity, available_quantity, purchase_unit_cost, reference_sale_price, created_by
    ) values (
      p_pharmacy_id, p_product_id, p_supplier_id, v_lot, p_expiry_date,
      p_quantity, p_quantity, p_purchase_unit_cost, p_reference_sale_price, v_uid
    )
    returning * into v_batch;
  end if;

  insert into public.stock_movements (
    pharmacy_id, product_id, batch_id, movement_type, quantity, quantity_before, quantity_after,
    reference, created_by, idempotency_key
  ) values (
    p_pharmacy_id, p_product_id, v_batch.id, 'receipt', p_quantity, v_before, v_before + p_quantity,
    nullif(btrim(p_reference), ''), v_uid, p_idempotency_key
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saída de stock
-- ---------------------------------------------------------------------------
create or replace function public.issue_stock(
  p_pharmacy_id uuid,
  p_batch_id uuid,
  p_quantity numeric,
  p_movement_type public.movement_type,
  p_idempotency_key text,
  p_reason text default null,
  p_reference text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager,stock_operator}');
  v_existing public.stock_movements;
  v_movement public.stock_movements;
  v_batch public.stock_batches;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if p_movement_type is null or p_movement_type not in
    ('issue', 'internal_transfer_out', 'damage', 'expired_disposal', 'return_to_supplier') then
    raise exception 'Tipo de saída inválido.' using errcode = 'P0001';
  end if;

  perform private.lock_idempotency(p_pharmacy_id, p_idempotency_key);
  v_existing := private.existing_movement(p_pharmacy_id, p_idempotency_key);
  if v_existing.id is not null then
    if v_existing.movement_type <> p_movement_type or v_existing.batch_id is distinct from p_batch_id then
      raise exception 'Chave de idempotência já utilizada noutra operação.' using errcode = 'P0001';
    end if;
    return v_existing;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade a retirar tem de ser maior que zero.' using errcode = 'P0001';
  end if;
  if p_movement_type in ('damage', 'expired_disposal', 'return_to_supplier')
     and char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'Indique o motivo desta saída.' using errcode = 'P0001';
  end if;

  select * into v_batch
  from public.stock_batches
  where id = p_batch_id and pharmacy_id = p_pharmacy_id
  for update;

  if v_batch.id is null then
    raise exception 'Lote não encontrado.' using errcode = 'P0001';
  end if;

  if p_movement_type in ('issue', 'internal_transfer_out') then
    if v_batch.status = 'blocked' then
      raise exception 'O lote % está bloqueado e não pode ser usado numa saída normal.', v_batch.lot_number
        using errcode = 'P0001';
    end if;
    if v_batch.expiry_date is not null and v_batch.expiry_date < private.pharmacy_today(p_pharmacy_id) then
      raise exception 'O lote % está expirado e não pode ser usado numa saída normal. Use "Eliminação por validade".',
        v_batch.lot_number using errcode = 'P0001';
    end if;
  end if;

  if v_batch.available_quantity < p_quantity then
    raise exception 'Quantidade insuficiente no lote %. Disponível: %.',
      v_batch.lot_number, private.fmt_qty(v_batch.available_quantity) using errcode = 'P0001';
  end if;

  update public.stock_batches
  set available_quantity = available_quantity - p_quantity
  where id = v_batch.id;

  insert into public.stock_movements (
    pharmacy_id, product_id, batch_id, movement_type, quantity, quantity_before, quantity_after,
    reason, reference, created_by, idempotency_key
  ) values (
    p_pharmacy_id, v_batch.product_id, v_batch.id, p_movement_type, p_quantity,
    v_batch.available_quantity, v_batch.available_quantity - p_quantity,
    v_reason, nullif(btrim(p_reference), ''), v_uid, p_idempotency_key
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajuste de inventário (gestor/proprietária)
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_pharmacy_id uuid,
  p_batch_id uuid,
  p_new_quantity numeric,
  p_reason text,
  p_idempotency_key text
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager}');
  v_existing public.stock_movements;
  v_movement public.stock_movements;
  v_batch public.stock_batches;
  v_reason text := nullif(btrim(p_reason), '');
  v_diff numeric;
begin
  perform private.lock_idempotency(p_pharmacy_id, p_idempotency_key);
  v_existing := private.existing_movement(p_pharmacy_id, p_idempotency_key);
  if v_existing.id is not null then
    if v_existing.movement_type not in ('adjustment_in', 'adjustment_out')
       or v_existing.batch_id is distinct from p_batch_id then
      raise exception 'Chave de idempotência já utilizada noutra operação.' using errcode = 'P0001';
    end if;
    return v_existing;
  end if;

  if char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'O ajuste exige um motivo.' using errcode = 'P0001';
  end if;
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'A nova quantidade não pode ser negativa.' using errcode = 'P0001';
  end if;

  select * into v_batch
  from public.stock_batches
  where id = p_batch_id and pharmacy_id = p_pharmacy_id
  for update;

  if v_batch.id is null then
    raise exception 'Lote não encontrado.' using errcode = 'P0001';
  end if;

  v_diff := p_new_quantity - v_batch.available_quantity;
  if v_diff = 0 then
    raise exception 'A quantidade indicada é igual à actual. Nada a ajustar.' using errcode = 'P0001';
  end if;

  update public.stock_batches set available_quantity = p_new_quantity where id = v_batch.id;

  insert into public.stock_movements (
    pharmacy_id, product_id, batch_id, movement_type, quantity, quantity_before, quantity_after,
    reason, created_by, idempotency_key
  ) values (
    p_pharmacy_id, v_batch.product_id, v_batch.id,
    case when v_diff > 0 then 'adjustment_in'::public.movement_type else 'adjustment_out'::public.movement_type end,
    abs(v_diff), v_batch.available_quantity, p_new_quantity, v_reason, v_uid, p_idempotency_key
  )
  returning * into v_movement;

  perform private.write_audit(p_pharmacy_id, 'stock_adjustment', 'stock_batches', v_batch.id::text,
    jsonb_build_object('before', v_batch.available_quantity, 'after', p_new_quantity, 'difference', v_diff,
                       'movement_id', v_movement.id));

  return v_movement;
end;
$$;

-- ---------------------------------------------------------------------------
-- Movimento correctivo (anulação por movimento inverso)
-- ---------------------------------------------------------------------------
create or replace function public.reverse_movement(
  p_pharmacy_id uuid,
  p_movement_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager}');
  v_existing public.stock_movements;
  v_original public.stock_movements;
  v_movement public.stock_movements;
  v_batch public.stock_batches;
  v_reason text := nullif(btrim(p_reason), '');
  v_increase boolean;
  v_after numeric;
begin
  perform private.lock_idempotency(p_pharmacy_id, p_idempotency_key);
  v_existing := private.existing_movement(p_pharmacy_id, p_idempotency_key);
  if v_existing.id is not null then
    if v_existing.reverses_movement_id is distinct from p_movement_id then
      raise exception 'Chave de idempotência já utilizada noutra operação.' using errcode = 'P0001';
    end if;
    return v_existing;
  end if;

  if char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'Indique o motivo da correcção.' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.stock_movements
  where id = p_movement_id and pharmacy_id = p_pharmacy_id;

  if v_original.id is null then
    raise exception 'Movimento não encontrado.' using errcode = 'P0001';
  end if;
  if v_original.reverses_movement_id is not null then
    raise exception 'Este movimento já é uma correcção. Registe um ajuste se for necessário.' using errcode = 'P0001';
  end if;
  if v_original.batch_id is null then
    raise exception 'Este movimento não está associado a um lote e não pode ser anulado automaticamente.'
      using errcode = 'P0001';
  end if;
  if exists (select 1 from public.stock_movements where reverses_movement_id = v_original.id) then
    raise exception 'Este movimento já foi corrigido.' using errcode = 'P0001';
  end if;

  select * into v_batch
  from public.stock_batches
  where id = v_original.batch_id and pharmacy_id = p_pharmacy_id
  for update;

  -- O original aumentou o stock? Então a correcção diminui, e vice-versa.
  v_increase := v_original.movement_type not in ('receipt', 'adjustment_in', 'internal_transfer_in');
  v_after := case when v_increase then v_batch.available_quantity + v_original.quantity
                  else v_batch.available_quantity - v_original.quantity end;

  if v_after < 0 then
    raise exception 'Não é possível anular: o lote % só tem % disponível.',
      v_batch.lot_number, private.fmt_qty(v_batch.available_quantity) using errcode = 'P0001';
  end if;

  update public.stock_batches set available_quantity = v_after where id = v_batch.id;

  insert into public.stock_movements (
    pharmacy_id, product_id, batch_id, movement_type, quantity, quantity_before, quantity_after,
    reason, reverses_movement_id, created_by, idempotency_key
  ) values (
    p_pharmacy_id, v_original.product_id, v_batch.id,
    case when v_increase then 'adjustment_in'::public.movement_type else 'adjustment_out'::public.movement_type end,
    v_original.quantity, v_batch.available_quantity, v_after, v_reason, v_original.id, v_uid, p_idempotency_key
  )
  returning * into v_movement;

  perform private.write_audit(p_pharmacy_id, 'movement_reversed', 'stock_movements', v_original.id::text,
    jsonb_build_object('reversal_movement_id', v_movement.id, 'quantity', v_original.quantity));

  return v_movement;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bloquear / desbloquear lote
-- ---------------------------------------------------------------------------
create or replace function public.set_batch_status(
  p_pharmacy_id uuid,
  p_batch_id uuid,
  p_status public.batch_status,
  p_reason text
)
returns public.stock_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager}');
  v_batch public.stock_batches;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if p_status not in ('active', 'blocked') then
    raise exception 'Estado inválido. Use "activo" ou "bloqueado".' using errcode = 'P0001';
  end if;
  if char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'Indique o motivo da alteração de estado.' using errcode = 'P0001';
  end if;

  update public.stock_batches
  set status = p_status, status_reason = v_reason
  where id = p_batch_id and pharmacy_id = p_pharmacy_id
  returning * into v_batch;

  if v_batch.id is null then
    raise exception 'Lote não encontrado.' using errcode = 'P0001';
  end if;
  perform v_uid;
  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contagem física
-- ---------------------------------------------------------------------------
create or replace function public.start_stock_count(p_pharmacy_id uuid, p_notes text default null)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager,stock_operator}');
  v_count public.stock_counts;
begin
  -- Serializa a abertura de contagens por farmácia.
  perform pg_advisory_xact_lock(hashtextextended('stock_count:' || p_pharmacy_id::text, 0));

  if exists (
    select 1 from public.stock_counts
    where pharmacy_id = p_pharmacy_id and status in ('draft', 'in_progress', 'review')
  ) then
    raise exception 'Já existe uma contagem em curso. Conclua-a ou cancele-a primeiro.' using errcode = 'P0001';
  end if;

  insert into public.stock_counts (pharmacy_id, status, started_by, notes)
  values (p_pharmacy_id, 'in_progress', v_uid, nullif(left(btrim(p_notes), 500), ''))
  returning * into v_count;

  insert into public.stock_count_items (pharmacy_id, stock_count_id, product_id, batch_id, expected_quantity)
  select b.pharmacy_id, v_count.id, b.product_id, b.id, b.available_quantity
  from public.stock_batches b
  where b.pharmacy_id = p_pharmacy_id
    and b.available_quantity > 0;

  return v_count;
end;
$$;

create or replace function public.record_count_item(
  p_pharmacy_id uuid,
  p_item_id uuid,
  p_counted_quantity numeric
)
returns public.stock_count_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager,stock_operator}');
  v_item public.stock_count_items;
begin
  if p_counted_quantity is not null and p_counted_quantity < 0 then
    raise exception 'A quantidade contada não pode ser negativa.' using errcode = 'P0001';
  end if;

  update public.stock_count_items i
  set counted_quantity = p_counted_quantity, counted_by = v_uid
  from public.stock_counts c
  where i.id = p_item_id
    and i.pharmacy_id = p_pharmacy_id
    and c.id = i.stock_count_id
    and c.status = 'in_progress'
  returning i.* into v_item;

  if v_item.id is null then
    raise exception 'Linha de contagem não encontrada ou contagem já fechada.' using errcode = 'P0001';
  end if;
  return v_item;
end;
$$;

create or replace function public.submit_stock_count(p_pharmacy_id uuid, p_count_id uuid)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager,stock_operator}');
  v_count public.stock_counts;
begin
  select * into v_count from public.stock_counts
  where id = p_count_id and pharmacy_id = p_pharmacy_id for update;

  if v_count.id is null or v_count.status <> 'in_progress' then
    raise exception 'A contagem não está em curso.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.stock_count_items where stock_count_id = p_count_id and counted_quantity is not null
  ) then
    raise exception 'Registe pelo menos uma quantidade contada antes de enviar para revisão.' using errcode = 'P0001';
  end if;

  update public.stock_counts set status = 'review' where id = p_count_id returning * into v_count;
  perform private.write_audit(p_pharmacy_id, 'stock_count_submitted', 'stock_counts', p_count_id::text, '{}'::jsonb);
  perform v_uid;
  return v_count;
end;
$$;

create or replace function public.approve_stock_count(p_pharmacy_id uuid, p_count_id uuid)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager}');
  v_count public.stock_counts;
  v_item record;
  v_batch public.stock_batches;
  v_after numeric;
  v_adjusted integer := 0;
begin
  select * into v_count from public.stock_counts
  where id = p_count_id and pharmacy_id = p_pharmacy_id for update;

  if v_count.id is null then
    raise exception 'Contagem não encontrada.' using errcode = 'P0001';
  end if;
  if v_count.status = 'completed' then
    return v_count; -- idempotente: aprovar duas vezes não duplica ajustes
  end if;
  if v_count.status <> 'review' then
    raise exception 'Só é possível aprovar uma contagem em revisão.' using errcode = 'P0001';
  end if;

  for v_item in
    select * from public.stock_count_items
    where stock_count_id = p_count_id and counted_quantity is not null and difference <> 0 and batch_id is not null
    order by batch_id
  loop
    select * into v_batch from public.stock_batches where id = v_item.batch_id for update;
    -- A diferença aplica-se sobre a quantidade actual (podem ter existido movimentos desde o início).
    v_after := v_batch.available_quantity + v_item.difference;
    if v_after < 0 then
      raise exception 'Não é possível aplicar a contagem: o lote % ficaria com quantidade negativa.',
        v_batch.lot_number using errcode = 'P0001';
    end if;

    update public.stock_batches set available_quantity = v_after where id = v_batch.id;

    insert into public.stock_movements (
      pharmacy_id, product_id, batch_id, movement_type, quantity, quantity_before, quantity_after,
      reason, stock_count_id, created_by, idempotency_key
    ) values (
      p_pharmacy_id, v_item.product_id, v_batch.id,
      case when v_item.difference > 0 then 'adjustment_in'::public.movement_type
           else 'adjustment_out'::public.movement_type end,
      abs(v_item.difference), v_batch.available_quantity, v_after,
      'Contagem física de ' || to_char(v_count.started_at at time zone 'Africa/Luanda', 'DD/MM/YYYY'),
      p_count_id, v_uid, 'count:' || p_count_id::text || ':' || v_item.id::text
    );
    v_adjusted := v_adjusted + 1;
  end loop;

  update public.stock_counts
  set status = 'completed', approved_by = v_uid, completed_at = now()
  where id = p_count_id
  returning * into v_count;

  perform private.write_audit(p_pharmacy_id, 'stock_count_approved', 'stock_counts', p_count_id::text,
    jsonb_build_object('adjusted_batches', v_adjusted));
  return v_count;
end;
$$;

create or replace function public.cancel_stock_count(p_pharmacy_id uuid, p_count_id uuid)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner,manager,stock_operator}');
  v_count public.stock_counts;
begin
  select * into v_count from public.stock_counts
  where id = p_count_id and pharmacy_id = p_pharmacy_id for update;

  if v_count.id is null or v_count.status not in ('draft', 'in_progress', 'review') then
    raise exception 'Esta contagem já não pode ser cancelada.' using errcode = 'P0001';
  end if;
  if v_count.started_by <> v_uid and not private.has_role(p_pharmacy_id, '{owner,manager}') then
    raise exception 'Só quem iniciou a contagem ou um gestor a pode cancelar.' using errcode = '42501';
  end if;

  update public.stock_counts set status = 'cancelled', completed_at = now()
  where id = p_count_id returning * into v_count;
  perform private.write_audit(p_pharmacy_id, 'stock_count_cancelled', 'stock_counts', p_count_id::text, '{}'::jsonb);
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Equipa
-- ---------------------------------------------------------------------------
create or replace function public.list_members(p_pharmacy_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  display_name text,
  email text,
  role public.member_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_see_email boolean;
begin
  perform private.assert_role(p_pharmacy_id, '{owner,manager,stock_operator,viewer}');
  v_can_see_email := private.has_role(p_pharmacy_id, '{owner}');
  return query
    select m.id, m.user_id, u.display_name,
           case when v_can_see_email then au.email::text end,
           m.role, m.is_active, m.created_at,
           case when v_can_see_email then au.last_sign_in_at end
    from public.pharmacy_members m
    join public.user_profiles u on u.id = m.user_id
    left join auth.users au on au.id = m.user_id
    where m.pharmacy_id = p_pharmacy_id
    order by m.is_active desc, u.display_name nulls last;
end;
$$;

create or replace function public.update_member(
  p_pharmacy_id uuid,
  p_member_id uuid,
  p_role public.member_role,
  p_is_active boolean
)
returns public.pharmacy_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_role(p_pharmacy_id, '{owner}');
  v_member public.pharmacy_members;
begin
  perform pg_advisory_xact_lock(hashtextextended('members:' || p_pharmacy_id::text, 0));

  select * into v_member from public.pharmacy_members
  where id = p_member_id and pharmacy_id = p_pharmacy_id for update;

  if v_member.id is null then
    raise exception 'Membro não encontrado.' using errcode = 'P0001';
  end if;
  if v_member.user_id = v_uid then
    raise exception 'Não pode alterar o seu próprio perfil ou acesso.' using errcode = 'P0001';
  end if;

  update public.pharmacy_members
  set role = coalesce(p_role, role), is_active = coalesce(p_is_active, is_active)
  where id = p_member_id
  returning * into v_member;

  if not exists (
    select 1 from public.pharmacy_members
    where pharmacy_id = p_pharmacy_id and role = 'owner' and is_active
  ) then
    raise exception 'A farmácia tem de manter pelo menos uma administradora activa.' using errcode = 'P0001';
  end if;

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução: só utilizadores autenticados; nunca anon.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function
  private.is_member(uuid),
  private.has_role(uuid, public.member_role[]),
  private.shares_pharmacy(uuid),
  private.is_owner_anywhere(),
  private.pharmacy_today(uuid)
to authenticated;

grant execute on function
  public.movement_summary(uuid, date, date),
  public.receive_stock(uuid, uuid, text, date, numeric, text, uuid, numeric, numeric, text),
  public.issue_stock(uuid, uuid, numeric, public.movement_type, text, text, text),
  public.adjust_stock(uuid, uuid, numeric, text, text),
  public.reverse_movement(uuid, uuid, text, text),
  public.set_batch_status(uuid, uuid, public.batch_status, text),
  public.start_stock_count(uuid, text),
  public.record_count_item(uuid, uuid, numeric),
  public.submit_stock_count(uuid, uuid),
  public.approve_stock_count(uuid, uuid),
  public.cancel_stock_count(uuid, uuid),
  public.list_members(uuid),
  public.update_member(uuid, uuid, public.member_role, boolean)
to authenticated;
