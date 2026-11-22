-- FarmaStock — dados FICTÍCIOS para desenvolvimento local. Nunca usar dados reais.
-- Contas de teste (só no ambiente local do Supabase CLI):
--   admin.a@farmastock.test     owner          Farmácia Demonstração A
--   gestor.a@farmastock.test    manager        Farmácia Demonstração A
--   operador.a@farmastock.test  stock_operator Farmácia Demonstração A
--   consulta.a@farmastock.test  viewer         Farmácia Demonstração A
--   admin.b@farmastock.test     owner          Farmácia Demonstração B
-- Palavra-passe de todas as contas de teste: FarmaStock-dev-2026

-- Utilizadores (auth) ---------------------------------------------------------
do $$
declare
  v_users jsonb := '[
    {"id":"a0000000-0000-4000-8000-000000000001","email":"admin.a@farmastock.test","name":"Ana Demonstração"},
    {"id":"a0000000-0000-4000-8000-000000000002","email":"gestor.a@farmastock.test","name":"Bruno Teste"},
    {"id":"a0000000-0000-4000-8000-000000000003","email":"operador.a@farmastock.test","name":"Carla Exemplo"},
    {"id":"a0000000-0000-4000-8000-000000000004","email":"consulta.a@farmastock.test","name":"Daniel Fictício"},
    {"id":"b0000000-0000-4000-8000-000000000001","email":"admin.b@farmastock.test","name":"Eva Ensaio"}
  ]';
  v_user jsonb;
  v_id uuid;
begin
  for v_user in select * from jsonb_array_elements(v_users) loop
    v_id := (v_user ->> 'id')::uuid;
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_user ->> 'email', extensions.crypt('FarmaStock-dev-2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', v_user ->> 'name'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text, 'email',
      jsonb_build_object('sub', v_id::text, 'email', v_user ->> 'email', 'email_verified', true),
      now(), now(), now()
    );
  end loop;
end;
$$;

-- Farmácias e membros ---------------------------------------------------------
insert into public.pharmacies (id, name, address, phone) values
  ('f0000000-0000-4000-8000-00000000000a', 'Farmácia Demonstração A', 'Rua Fictícia, 1 — Luanda', '+244 900 000 001'),
  ('f0000000-0000-4000-8000-00000000000b', 'Farmácia Demonstração B', 'Avenida de Teste, 2 — Luanda', '+244 900 000 002');

insert into public.pharmacy_members (pharmacy_id, user_id, role) values
  ('f0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('f0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000002', 'manager'),
  ('f0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000003', 'stock_operator'),
  ('f0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000004', 'viewer'),
  ('f0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'owner');

-- Fornecedores ------------------------------------------------------------------
insert into public.suppliers (id, pharmacy_id, name, phone, email) values
  ('50000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-00000000000a', 'Distribuidora Fictícia Lda.', '+244 900 100 100', 'encomendas@distribuidora.test'),
  ('50000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-00000000000a', 'Grossista de Ensaio SA', '+244 900 200 200', null),
  ('50000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-00000000000b', 'Fornecedor B de Teste', null, null);

-- Produtos (genéricos comuns; códigos inventados) -------------------------------
insert into public.products (id, pharmacy_id, name, active_ingredient, strength, dosage_form, presentation, unit_name, internal_code, category, minimum_stock, created_by) values
  ('c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-00000000000a', 'Paracetamol Genérico', 'Paracetamol', '500 mg', 'Comprimido', 'Caixa de 20 comprimidos', 'caixa', 'MED-0001', 'Analgésicos', 20, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-00000000000a', 'Ibuprofeno Genérico', 'Ibuprofeno', '400 mg', 'Comprimido', 'Caixa de 30 comprimidos', 'caixa', 'MED-0002', 'Anti-inflamatórios', 15, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-00000000000a', 'Amoxicilina Genérico', 'Amoxicilina', '500 mg', 'Cápsula', 'Caixa de 16 cápsulas', 'caixa', 'MED-0003', 'Antibióticos', 10, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-00000000000a', 'Sais de Reidratação Oral', 'Sais de reidratação', null, 'Pó para solução oral', 'Saqueta', 'saqueta', 'MED-0004', 'Reidratação', 50, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-00000000000a', 'Xarope para a Tosse Exemplo', 'Carbocisteína', '50 mg/ml', 'Xarope', 'Frasco de 200 ml', 'frasco', 'MED-0005', 'Respiratório', 8, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-00000000000a', 'Compressas Esterilizadas', null, null, null, 'Pacote de 10 unidades', 'pacote', 'PEN-0001', 'Material de penso', 12, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-00000000000a', 'Álcool Etílico 70%', null, '70%', 'Solução', 'Frasco de 250 ml', 'frasco', 'HIG-0001', 'Higiene', 10, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-00000000000a', 'Metformina Genérico', 'Metformina', '850 mg', 'Comprimido', 'Caixa de 60 comprimidos', 'caixa', 'MED-0006', 'Diabetes', 6, 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000101', 'f0000000-0000-4000-8000-00000000000b', 'Produto Exclusivo da Farmácia B', 'Substância de teste', '10 mg', 'Comprimido', 'Caixa de 10', 'caixa', 'B-0001', 'Teste', 5, 'b0000000-0000-4000-8000-000000000001');

-- Movimentos: usam as funções RPC para ficarem coerentes com os lotes ----------
do $$
declare
  a constant uuid := 'f0000000-0000-4000-8000-00000000000a';
  b constant uuid := 'f0000000-0000-4000-8000-00000000000b';
  today date := (now() at time zone 'Africa/Luanda')::date;
  v_batch uuid;
begin
  -- Agir como a administradora A (apenas para o seed).
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);

  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000001', 'PCT2401', today + 400, 60, 'seed-0001', '50000000-0000-4000-8000-000000000001', 350, 600);
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000001', 'PCT2312', today + 25, 12, 'seed-0002', '50000000-0000-4000-8000-000000000001', 340, 600);
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000002', 'IBU0907', today + 55, 10, 'seed-0003', '50000000-0000-4000-8000-000000000002', 900, 1500);
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000003', 'AMX3301', today + 300, 24, 'seed-0004', '50000000-0000-4000-8000-000000000001', 1200, 2100);
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000004', 'SRO1100', today + 85, 40, 'seed-0005', '50000000-0000-4000-8000-000000000002', 150, 300);
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000005', 'XAR0042', today + 500, 5, 'seed-0006', '50000000-0000-4000-8000-000000000002', 1800, 3000);
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000006', 'CMP7788', null, 30, 'seed-0007', null, 500, null);
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000007', 'ALC5050', today + 700, 4, 'seed-0008', null, 700, 1100);

  -- Saídas e ajustes de exemplo.
  select id into v_batch from public.stock_batches where pharmacy_id = a and lot_number = 'PCT2401';
  perform public.issue_stock(a, v_batch, 18, 'issue', 'seed-0009', null, 'Registo do sistema externo');
  perform public.issue_stock(a, v_batch, 2, 'damage', 'seed-0010', 'Embalagens danificadas na recepção');

  select id into v_batch from public.stock_batches where pharmacy_id = a and lot_number = 'IBU0907';
  perform public.issue_stock(a, v_batch, 4, 'issue', 'seed-0011');

  select id into v_batch from public.stock_batches where pharmacy_id = a and lot_number = 'AMX3301';
  perform public.adjust_stock(a, v_batch, 22, 'Diferença detectada em verificação de prateleira', 'seed-0012');

  -- Lote bloqueado (exemplo de retirada preventiva).
  perform public.receive_stock(a, 'c0000000-0000-4000-8000-000000000002', 'IBU0815', today + 200, 6, 'seed-0013', '50000000-0000-4000-8000-000000000002');
  select id into v_batch from public.stock_batches where pharmacy_id = a and lot_number = 'IBU0815';
  perform public.set_batch_status(a, v_batch, 'blocked', 'Retirada preventiva comunicada pelo fornecedor (exemplo fictício)');

  -- Farmácia B.
  perform set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
  perform public.receive_stock(b, 'c0000000-0000-4000-8000-000000000101', 'BTEST01', today + 120, 9, 'seed-0101', '50000000-0000-4000-8000-000000000003');

  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- Lote já expirado (inserido directamente: as funções recusam entradas expiradas).
with batch as (
  insert into public.stock_batches (pharmacy_id, product_id, lot_number, expiry_date, received_quantity, available_quantity, received_at, created_by)
  values ('f0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000008', 'MTF0001',
          (now() at time zone 'Africa/Luanda')::date - 10, 3, 3, now() - interval '400 days', 'a0000000-0000-4000-8000-000000000001')
  returning id, pharmacy_id, product_id
)
insert into public.stock_movements (pharmacy_id, product_id, batch_id, movement_type, quantity, quantity_before, quantity_after, created_by, created_at, idempotency_key)
select pharmacy_id, product_id, id, 'receipt', 3, 0, 3, 'a0000000-0000-4000-8000-000000000001', now() - interval '400 days', 'seed-0014'
from batch;
