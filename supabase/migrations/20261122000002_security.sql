-- FarmaStock — funções auxiliares de segurança, auditoria, RLS e permissões.
-- Princípios: nunca confiar no pharmacy_id enviado pelo cliente; search_path vazio
-- em todas as funções; SECURITY DEFINER só onde é indispensável e com validação explícita.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (esquema private, não exposto pela API)
-- SECURITY DEFINER: lêem pharmacy_members sem recursão de RLS. Só respondem
-- sobre o próprio utilizador autenticado (auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function private.is_member(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pharmacy_members m
    join public.pharmacies p on p.id = m.pharmacy_id
    where m.pharmacy_id = p_pharmacy_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and p.is_active
  );
$$;

create or replace function private.has_role(p_pharmacy_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pharmacy_members m
    join public.pharmacies p on p.id = m.pharmacy_id
    where m.pharmacy_id = p_pharmacy_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and p.is_active
      and m.role = any (p_roles)
  );
$$;

create or replace function private.shares_pharmacy(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pharmacy_members mine
    join public.pharmacy_members theirs on theirs.pharmacy_id = mine.pharmacy_id
    where mine.user_id = (select auth.uid())
      and mine.is_active
      and theirs.user_id = p_user_id
  );
$$;

create or replace function private.is_owner_anywhere()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pharmacy_members m
    where m.user_id = (select auth.uid()) and m.is_active and m.role = 'owner'
  );
$$;

-- Lança erro se o utilizador não tiver um dos perfis indicados nesta farmácia.
create or replace function private.assert_role(p_pharmacy_id uuid, p_roles public.member_role[])
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sessão inválida. Inicie sessão novamente.' using errcode = '28000';
  end if;
  if p_pharmacy_id is null or not private.has_role(p_pharmacy_id, p_roles) then
    raise exception 'Não tem permissão para esta operação nesta farmácia.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Dia actual no fuso da farmácia (por omissão Africa/Luanda).
create or replace function private.pharmacy_today(p_pharmacy_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.pharmacies p where p.id = p_pharmacy_id),
    'Africa/Luanda'
  ))::date;
$$;

create or replace function private.write_audit(
  p_pharmacy_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (pharmacy_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_pharmacy_id, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Perfil criado automaticamente quando o Supabase Auth cria o utilizador.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Auditoria genérica por trigger.
-- tg_argv[0]: campos críticos (valores guardados), separados por vírgula
-- tg_argv[1]: campos ignorados (não contam como alteração)
-- Guarda só nomes dos campos alterados + valores dos críticos (sem texto livre).
-- ---------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_critical text[] := string_to_array(coalesce(tg_argv[0], ''), ',');
  v_ignored text[] := array['updated_at', 'created_at'] || string_to_array(coalesce(tg_argv[1], ''), ',');
  v_changed text[];
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_pharmacy uuid;
  k text;
begin
  v_pharmacy := case when tg_table_name = 'pharmacies' then (v_row ->> 'id')::uuid
                     else (v_row ->> 'pharmacy_id')::uuid end;

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_new) n
    where n.key <> all (v_ignored)
      and n.value is distinct from (v_old -> n.key);
    if v_changed is null then
      return null;
    end if;
    foreach k in array v_changed loop
      if k = any (v_critical) then
        v_before := v_before || jsonb_build_object(k, v_old -> k);
        v_after := v_after || jsonb_build_object(k, v_new -> k);
      end if;
    end loop;
  else
    foreach k in array v_critical loop
      if k <> '' and v_row ? k then
        v_after := v_after || jsonb_build_object(k, v_row -> k);
      end if;
    end loop;
  end if;

  insert into public.audit_logs (pharmacy_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_pharmacy,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    jsonb_strip_nulls(jsonb_build_object(
      'changed', to_jsonb(v_changed),
      'before', nullif(v_before, '{}'::jsonb),
      'after', nullif(v_after, '{}'::jsonb)
    ))
  );
  return null;
end;
$$;

create trigger audit_pharmacies after update on public.pharmacies
  for each row execute function private.audit_row_change('name,timezone,currency,expiry_alert_days,is_active', '');
create trigger audit_pharmacy_members after insert or update on public.pharmacy_members
  for each row execute function private.audit_row_change('role,is_active,user_id', '');
create trigger audit_products after insert or update on public.products
  for each row execute function private.audit_row_change('name,minimum_stock,is_active,unit_name,barcode,internal_code', '');
create trigger audit_suppliers after insert or update on public.suppliers
  for each row execute function private.audit_row_change('name,is_active', '');
create trigger audit_stock_batches after update on public.stock_batches
  for each row execute function private.audit_row_change(
    'status,lot_number,expiry_date,reference_sale_price,purchase_unit_cost,supplier_id',
    'available_quantity,received_quantity,received_at'
  );

-- ---------------------------------------------------------------------------
-- RLS em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.pharmacies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.pharmacy_members enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.stock_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.privacy_acknowledgements enable row level security;
alter table public.backup_runs enable row level security;

-- pharmacies
create policy pharmacies_select on public.pharmacies for select to authenticated
  using (private.is_member(id));
create policy pharmacies_update on public.pharmacies for update to authenticated
  using (private.has_role(id, '{owner}')) with check (private.has_role(id, '{owner}'));

-- user_profiles
create policy user_profiles_select on public.user_profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_pharmacy(id));
create policy user_profiles_update on public.user_profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- pharmacy_members (alterações só via RPC / Edge Function)
create policy pharmacy_members_select on public.pharmacy_members for select to authenticated
  using (private.is_member(pharmacy_id));

-- products
create policy products_select on public.products for select to authenticated
  using (private.is_member(pharmacy_id));
create policy products_insert on public.products for insert to authenticated
  with check (private.has_role(pharmacy_id, '{owner,manager}') and created_by = (select auth.uid()));
create policy products_update on public.products for update to authenticated
  using (private.has_role(pharmacy_id, '{owner,manager}'))
  with check (private.has_role(pharmacy_id, '{owner,manager}'));

-- suppliers
create policy suppliers_select on public.suppliers for select to authenticated
  using (private.is_member(pharmacy_id));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (private.has_role(pharmacy_id, '{owner,manager}'));
create policy suppliers_update on public.suppliers for update to authenticated
  using (private.has_role(pharmacy_id, '{owner,manager}'))
  with check (private.has_role(pharmacy_id, '{owner,manager}'));

-- stock_batches (quantidades só via RPC; colunas editáveis limitadas por GRANT)
create policy stock_batches_select on public.stock_batches for select to authenticated
  using (private.is_member(pharmacy_id));
create policy stock_batches_update on public.stock_batches for update to authenticated
  using (private.has_role(pharmacy_id, '{owner,manager}'))
  with check (private.has_role(pharmacy_id, '{owner,manager}'));

-- stock_movements, stock_counts, stock_count_items: só leitura directa
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (private.is_member(pharmacy_id));
create policy stock_counts_select on public.stock_counts for select to authenticated
  using (private.is_member(pharmacy_id));
create policy stock_count_items_select on public.stock_count_items for select to authenticated
  using (private.is_member(pharmacy_id));

-- audit_logs: proprietária e gestor
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.has_role(pharmacy_id, '{owner,manager}'));

-- privacy_acknowledgements: cada utilizador só vê e cria as suas
create policy privacy_ack_select on public.privacy_acknowledgements for select to authenticated
  using (user_id = (select auth.uid()));
create policy privacy_ack_insert on public.privacy_acknowledgements for insert to authenticated
  with check (user_id = (select auth.uid()));

-- backup_runs: estado técnico visível só a administradoras (owner)
create policy backup_runs_select on public.backup_runs for select to authenticated
  using (private.is_owner_anywhere());

-- ---------------------------------------------------------------------------
-- Permissões (o Supabase dá ALL por omissão a anon/authenticated: retirar tudo
-- e conceder só o necessário).
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

grant execute on function
  private.is_member(uuid),
  private.has_role(uuid, public.member_role[]),
  private.shares_pharmacy(uuid),
  private.is_owner_anywhere(),
  private.pharmacy_today(uuid)
to authenticated;

grant select on
  public.pharmacies,
  public.user_profiles,
  public.pharmacy_members,
  public.products,
  public.suppliers,
  public.stock_batches,
  public.stock_movements,
  public.stock_counts,
  public.stock_count_items,
  public.audit_logs,
  public.privacy_acknowledgements,
  public.backup_runs
to authenticated;

grant update (name, address, phone, timezone, currency, expiry_alert_days) on public.pharmacies to authenticated;
grant update (display_name) on public.user_profiles to authenticated;

grant insert (pharmacy_id, name, active_ingredient, brand, strength, dosage_form, presentation, unit_name,
              barcode, internal_code, category, minimum_stock, notes, is_active, created_by)
  on public.products to authenticated;
grant update (name, active_ingredient, brand, strength, dosage_form, presentation, unit_name,
              barcode, internal_code, category, minimum_stock, notes, is_active)
  on public.products to authenticated;

grant insert (pharmacy_id, name, phone, email, notes, is_active) on public.suppliers to authenticated;
grant update (name, phone, email, notes, is_active) on public.suppliers to authenticated;

-- Nunca available_quantity / received_quantity / status / pharmacy_id.
grant update (lot_number, expiry_date, supplier_id, purchase_unit_cost, reference_sale_price)
  on public.stock_batches to authenticated;

grant insert (user_id, notice_version) on public.privacy_acknowledgements to authenticated;

-- Não alterar pharmacy_id de linhas existentes: impedido pelos GRANT de coluna acima.
