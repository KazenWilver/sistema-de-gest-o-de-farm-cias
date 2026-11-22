-- Verificações de integridade após restauro. Falha (exception) ao primeiro problema.
do $$
declare
  v_count bigint;
begin
  -- 1) RLS activo em todas as tabelas da aplicação
  select count(*) into v_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_count > 0 then raise exception 'Há % tabela(s) public sem RLS', v_count; end if;

  -- 2) Nenhum lote com quantidade negativa
  select count(*) into v_count from public.stock_batches where available_quantity < 0;
  if v_count > 0 then raise exception 'Há % lote(s) com quantidade negativa', v_count; end if;

  -- 3) Quantidade do lote = soma das variações dos movimentos (lotes nascem a 0 por uma entrada)
  select count(*) into v_count
  from public.stock_batches b
  join (
    select m.pharmacy_id, m.batch_id, sum(m.quantity_after - m.quantity_before) as delta
    from public.stock_movements m where m.batch_id is not null
    group by m.pharmacy_id, m.batch_id
  ) s on s.pharmacy_id = b.pharmacy_id and s.batch_id = b.id
  where s.delta <> b.available_quantity;
  if v_count > 0 then raise exception 'Há % lote(s) cujo stock não coincide com os movimentos', v_count; end if;

  -- 4) Cada membro tem perfil e conta auth (FK verificadas manualmente: a carga correu sem triggers)
  select count(*) into v_count from public.pharmacy_members pm
  where not exists (select 1 from public.user_profiles p where p.id = pm.user_id);
  if v_count > 0 then raise exception 'Há % membro(s) sem perfil', v_count; end if;

  select count(*) into v_count from public.user_profiles p
  where not exists (select 1 from auth.users u where u.id = p.id);
  if v_count > 0 then
    raise warning 'Há % perfil(is) sem conta auth: restaurar contas pelo procedimento separado', v_count;
  end if;

  -- 5) Triggers de imutabilidade presentes
  select count(*) into v_count from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname in ('stock_movements', 'audit_logs') and not t.tgisinternal and t.tgname like '%immutable%';
  if v_count < 2 then raise exception 'Triggers de imutabilidade em falta (%)', v_count; end if;

  raise notice 'Verificações de integridade: OK';
end $$;
