import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asAnon, asUser, createDatabase, createUser, newKey } from './harness';

// Identificadores fictícios
const PH_A = '11111111-1111-4111-8111-111111111111';
const PH_B = '22222222-2222-4222-8222-222222222222';
const OWNER_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const MANAGER_A = 'aaaaaaaa-0000-4000-8000-000000000002';
const OPERATOR_A = 'aaaaaaaa-0000-4000-8000-000000000003';
const VIEWER_A = 'aaaaaaaa-0000-4000-8000-000000000004';
const OWNER_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const OUTSIDER = 'cccccccc-0000-4000-8000-000000000001';
const PRODUCT_A = '33333333-3333-4333-8333-333333333331';
const PRODUCT_B = '33333333-3333-4333-8333-333333333332';
const SUPPLIER_B = '44444444-4444-4444-8444-444444444442';

let db: PGlite;

async function receive(
  user: string,
  pharmacy: string,
  product: string,
  lot: string,
  qty: number,
  key = newKey(),
) {
  const rows = await asUser(
    db,
    user,
    `select * from public.receive_stock($1, $2, $3, (current_date + 180), $4, $5)`,
    [pharmacy, product, lot, qty, key],
  );
  return rows[0] as { id: string; batch_id: string; quantity_after: string };
}

async function available(batchId: string): Promise<number> {
  const r = await db.query<{ q: string }>(
    `select available_quantity as q from public.stock_batches where id = $1`,
    [batchId],
  );
  return Number(r.rows[0]?.q);
}

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, name] of [
    [OWNER_A, 'Dona A'],
    [MANAGER_A, 'Gestor A'],
    [OPERATOR_A, 'Operador A'],
    [VIEWER_A, 'Consulta A'],
    [OWNER_B, 'Dona B'],
    [OUTSIDER, 'Sem farmácia'],
  ] as const) {
    await createUser(db, id, name);
  }
  await db.exec(`
    insert into public.pharmacies (id, name) values ('${PH_A}', 'Farmácia A'), ('${PH_B}', 'Farmácia B');
    insert into public.pharmacy_members (pharmacy_id, user_id, role) values
      ('${PH_A}', '${OWNER_A}', 'owner'),
      ('${PH_A}', '${MANAGER_A}', 'manager'),
      ('${PH_A}', '${OPERATOR_A}', 'stock_operator'),
      ('${PH_A}', '${VIEWER_A}', 'viewer'),
      ('${PH_B}', '${OWNER_B}', 'owner');
    insert into public.products (id, pharmacy_id, name, unit_name, minimum_stock)
      values ('${PRODUCT_A}', '${PH_A}', 'Produto A', 'caixa', 5), ('${PRODUCT_B}', '${PH_B}', 'Produto B', 'caixa', 0);
    insert into public.suppliers (id, pharmacy_id, name) values ('${SUPPLIER_B}', '${PH_B}', 'Fornecedor B');
  `);
  await receive(OWNER_B, PH_B, PRODUCT_B, 'LOTB1', 10);
});

afterAll(async () => {
  await db.close();
});

describe('isolamento multi-tenant (RLS)', () => {
  it('o utilizador A não lê dados da farmácia B', async () => {
    for (const table of [
      'products',
      'stock_batches',
      'suppliers',
      'stock_movements',
      'audit_logs',
      'product_stock',
      'batch_overview',
      'movement_overview',
    ]) {
      const rows = await asUser(db, OWNER_A, `select * from public.${table} where pharmacy_id = $1`, [PH_B]);
      expect(rows, table).toHaveLength(0);
    }
    const pharmacies = await asUser(db, OWNER_A, `select id from public.pharmacies`);
    expect(pharmacies.map((r) => r.id)).toEqual([PH_A]);
  });

  it('o utilizador A não insere registos com o pharmacy_id da farmácia B', async () => {
    await expect(
      asUser(
        db,
        OWNER_A,
        `insert into public.products (pharmacy_id, name, unit_name, created_by) values ($1, 'X', 'un', $2)`,
        [PH_B, OWNER_A],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, OWNER_A, `insert into public.suppliers (pharmacy_id, name) values ($1, 'X')`, [PH_B]),
    ).rejects.toThrow(/row-level security/);
  });

  it('o utilizador A não altera nem apaga registos da farmácia B', async () => {
    const updated = await asUser(
      db,
      OWNER_A,
      `update public.products set name = 'Hack' where id = $1 returning id`,
      [PRODUCT_B],
    );
    expect(updated).toHaveLength(0);
    await expect(
      asUser(db, OWNER_A, `delete from public.products where id = $1`, [PRODUCT_B]),
    ).rejects.toThrow(/permission denied/);
    const name = await db.query<{ name: string }>(`select name from public.products where id = $1`, [
      PRODUCT_B,
    ]);
    expect(name.rows[0]?.name).toBe('Produto B');
  });

  it('o utilizador A não opera stock da farmácia B através das funções', async () => {
    await expect(receive(OWNER_A, PH_B, PRODUCT_B, 'LOTX', 1)).rejects.toThrow(/permissão/);
    const batch = await db.query<{ id: string }>(
      `select id from public.stock_batches where pharmacy_id = $1`,
      [PH_B],
    );
    await expect(
      asUser(db, OWNER_A, `select public.issue_stock($1, $2, 1, 'issue', $3)`, [
        PH_B,
        batch.rows[0]?.id,
        newKey(),
      ]),
    ).rejects.toThrow(/permissão/);
    // Mesmo indicando a farmácia A com um lote de B, o lote não é encontrado.
    await expect(
      asUser(db, OWNER_A, `select public.issue_stock($1, $2, 1, 'issue', $3)`, [
        PH_A,
        batch.rows[0]?.id,
        newKey(),
      ]),
    ).rejects.toThrow(/Lote não encontrado/);
  });

  it('um utilizador sem associação não acede a dados operacionais', async () => {
    for (const table of ['pharmacies', 'products', 'stock_batches', 'stock_movements', 'pharmacy_members']) {
      const rows = await asUser(db, OUTSIDER, `select * from public.${table}`);
      expect(rows, table).toHaveLength(0);
    }
    await expect(receive(OUTSIDER, PH_A, PRODUCT_A, 'LOTY', 1)).rejects.toThrow(/permissão/);
  });

  it('o papel anon não tem acesso a tabelas nem funções', async () => {
    await expect(asAnon(db, `select * from public.products`)).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, `select public.receive_stock($1, $2, 'L', null, 1, 'abcdefgh-key')`, [PH_A, PRODUCT_A]),
    ).rejects.toThrow(/permission denied/);
  });

  it('o cliente não chama funções internas nem altera quantidades directamente', async () => {
    const batch = await receive(OWNER_A, PH_A, PRODUCT_A, 'DIRECT', 5);
    await expect(
      asUser(db, OWNER_A, `update public.stock_batches set available_quantity = 999 where id = $1`, [
        batch.batch_id,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, OWNER_A, `insert into public.stock_movements (pharmacy_id) values ($1)`, [PH_A]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, OWNER_A, `select private.write_audit($1, 'x', 'y', 'z')`, [PH_A]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, OWNER_A, `update public.products set pharmacy_id = $1 where id = $2`, [PH_B, PRODUCT_A]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('perfis', () => {
  it('viewer não altera stock nem produtos', async () => {
    await expect(receive(VIEWER_A, PH_A, PRODUCT_A, 'VIEW1', 1)).rejects.toThrow(/permissão/);
    await expect(
      asUser(
        db,
        VIEWER_A,
        `insert into public.products (pharmacy_id, name, unit_name, created_by) values ($1, 'X', 'un', $2)`,
        [PH_A, VIEWER_A],
      ),
    ).rejects.toThrow(/row-level security/);
    const rows = await asUser(db, VIEWER_A, `select id from public.products where pharmacy_id = $1`, [PH_A]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('stock_operator regista entradas mas não faz ajustes nem gere contas', async () => {
    const m = await receive(OPERATOR_A, PH_A, PRODUCT_A, 'OPER1', 3);
    expect(Number(m.quantity_after)).toBe(3);
    await expect(
      asUser(db, OPERATOR_A, `select public.adjust_stock($1, $2, 1, 'Motivo de teste', $3)`, [
        PH_A,
        m.batch_id,
        newKey(),
      ]),
    ).rejects.toThrow(/permissão/);
    const members = await asUser<{ member_id: string }>(
      db,
      OWNER_A,
      `select member_id from public.list_members($1)`,
      [PH_A],
    );
    await expect(
      asUser(db, OPERATOR_A, `select public.update_member($1, $2, 'owner', true)`, [
        PH_A,
        members[0]?.member_id,
      ]),
    ).rejects.toThrow(/permissão/);
  });

  it('só a administradora vê emails da equipa', async () => {
    const asOwner = await asUser<{ email: string | null }>(
      db,
      OWNER_A,
      `select email from public.list_members($1)`,
      [PH_A],
    );
    expect(asOwner.some((r) => r.email)).toBe(true);
    const asManager = await asUser<{ email: string | null }>(
      db,
      MANAGER_A,
      `select email from public.list_members($1)`,
      [PH_A],
    );
    expect(asManager.every((r) => r.email === null)).toBe(true);
  });

  it('a auditoria é visível para gestor mas não para operador', async () => {
    const manager = await asUser(db, MANAGER_A, `select id from public.audit_logs where pharmacy_id = $1`, [
      PH_A,
    ]);
    expect(manager.length).toBeGreaterThan(0);
    const operator = await asUser(db, OPERATOR_A, `select id from public.audit_logs`);
    expect(operator).toHaveLength(0);
  });
});

describe('operações de stock', () => {
  it('entrada cria lote e movimento; saída reduz sem ficar negativa', async () => {
    const r = await receive(OPERATOR_A, PH_A, PRODUCT_A, 'flow1', 10);
    const lot = await db.query<{ lot_number: string }>(
      `select lot_number from public.stock_batches where id = $1`,
      [r.batch_id],
    );
    expect(lot.rows[0]?.lot_number).toBe('FLOW1');
    await asUser(db, OPERATOR_A, `select public.issue_stock($1, $2, 4, 'issue', $3)`, [
      PH_A,
      r.batch_id,
      newKey(),
    ]);
    expect(await available(r.batch_id)).toBe(6);
    await expect(
      asUser(db, OPERATOR_A, `select public.issue_stock($1, $2, 7, 'issue', $3)`, [
        PH_A,
        r.batch_id,
        newKey(),
      ]),
    ).rejects.toThrow(/Quantidade insuficiente/);
    expect(await available(r.batch_id)).toBe(6);
  });

  it('rejeita quantidade zero ou negativa', async () => {
    await expect(receive(OPERATOR_A, PH_A, PRODUCT_A, 'ZERO', 0)).rejects.toThrow(/maior que zero/);
    await expect(receive(OPERATOR_A, PH_A, PRODUCT_A, 'NEG', -2)).rejects.toThrow(/maior que zero/);
  });

  it('movimento repetido com a mesma chave não é duplicado', async () => {
    const key = newKey();
    const first = await receive(OPERATOR_A, PH_A, PRODUCT_A, 'IDEM1', 5, key);
    const second = await receive(OPERATOR_A, PH_A, PRODUCT_A, 'IDEM1', 5, key);
    expect(second.id).toBe(first.id);
    expect(await available(first.batch_id)).toBe(5);

    const issueKey = newKey();
    const sql = `select id from public.issue_stock($1, $2, 2, 'issue', $3)`;
    const i1 = await asUser(db, OPERATOR_A, sql, [PH_A, first.batch_id, issueKey]);
    const i2 = await asUser(db, OPERATOR_A, sql, [PH_A, first.batch_id, issueKey]);
    expect(i2[0]?.id).toBe(i1[0]?.id);
    expect(await available(first.batch_id)).toBe(3);
  });

  it('lote expirado não pode ser usado numa saída normal, mas pode ser eliminado', async () => {
    const ins = await db.query<{ id: string }>(
      `insert into public.stock_batches (pharmacy_id, product_id, lot_number, expiry_date, received_quantity, available_quantity)
       values ($1, $2, 'EXP1', current_date - 3, 4, 4) returning id`,
      [PH_A, PRODUCT_A],
    );
    const batchId = ins.rows[0]!.id;
    await expect(
      asUser(db, OPERATOR_A, `select public.issue_stock($1, $2, 1, 'issue', $3)`, [PH_A, batchId, newKey()]),
    ).rejects.toThrow(/expirado/);
    await expect(
      asUser(db, OPERATOR_A, `select public.issue_stock($1, $2, 4, 'expired_disposal', $3)`, [
        PH_A,
        batchId,
        newKey(),
      ]),
    ).rejects.toThrow(/motivo/);
    await asUser(
      db,
      OPERATOR_A,
      `select public.issue_stock($1, $2, 4, 'expired_disposal', $3, 'Validade ultrapassada')`,
      [PH_A, batchId, newKey()],
    );
    expect(await available(batchId)).toBe(0);
    const ov = await asUser<{ effective_status: string }>(
      db,
      VIEWER_A,
      `select effective_status from public.batch_overview where id = $1`,
      [batchId],
    );
    expect(ov[0]?.effective_status).toBe('expired');
  });

  it('não aceita entrada de lote já expirado', async () => {
    await expect(
      asUser(db, OPERATOR_A, `select public.receive_stock($1, $2, 'OLD', current_date - 1, 1, $3)`, [
        PH_A,
        PRODUCT_A,
        newKey(),
      ]),
    ).rejects.toThrow(/já passou/);
  });

  it('lote bloqueado não pode ser usado numa saída normal', async () => {
    const r = await receive(OPERATOR_A, PH_A, PRODUCT_A, 'BLOCK1', 5);
    await expect(
      asUser(db, OPERATOR_A, `select public.set_batch_status($1, $2, 'blocked', 'Teste')`, [
        PH_A,
        r.batch_id,
      ]),
    ).rejects.toThrow(/permissão/);
    await asUser(db, MANAGER_A, `select public.set_batch_status($1, $2, 'blocked', 'Retirada de teste')`, [
      PH_A,
      r.batch_id,
    ]);
    await expect(
      asUser(db, OPERATOR_A, `select public.issue_stock($1, $2, 1, 'issue', $3)`, [
        PH_A,
        r.batch_id,
        newKey(),
      ]),
    ).rejects.toThrow(/bloqueado/);
    const audit = await db.query(
      `select metadata from public.audit_logs where entity_id = $1 and entity_type = 'stock_batches'`,
      [r.batch_id],
    );
    expect(JSON.stringify(audit.rows)).toContain('blocked');
  });

  it('ajuste exige motivo, regista antes/depois e não deixa negativo', async () => {
    const r = await receive(OPERATOR_A, PH_A, PRODUCT_A, 'ADJ1', 8);
    await expect(
      asUser(db, MANAGER_A, `select public.adjust_stock($1, $2, 6, '', $3)`, [PH_A, r.batch_id, newKey()]),
    ).rejects.toThrow(/motivo/);
    await expect(
      asUser(db, MANAGER_A, `select public.adjust_stock($1, $2, -1, 'Teste negativo', $3)`, [
        PH_A,
        r.batch_id,
        newKey(),
      ]),
    ).rejects.toThrow(/negativa/);
    const rows = await asUser<{
      movement_type: string;
      quantity_before: string;
      quantity_after: string;
      quantity: string;
    }>(db, MANAGER_A, `select * from public.adjust_stock($1, $2, 6, 'Contagem de prateleira', $3)`, [
      PH_A,
      r.batch_id,
      newKey(),
    ]);
    expect(rows[0]).toMatchObject({ movement_type: 'adjustment_out' });
    expect(Number(rows[0]?.quantity_before)).toBe(8);
    expect(Number(rows[0]?.quantity_after)).toBe(6);
    expect(Number(rows[0]?.quantity)).toBe(2);
  });

  it('corrige por movimento inverso, uma única vez', async () => {
    const r = await receive(OPERATOR_A, PH_A, PRODUCT_A, 'REV1', 7);
    const rev = await asUser<{ id: string; reverses_movement_id: string }>(
      db,
      MANAGER_A,
      `select * from public.reverse_movement($1, $2, 'Entrada registada por engano', $3)`,
      [PH_A, r.id, newKey()],
    );
    expect(rev[0]?.reverses_movement_id).toBe(r.id);
    expect(await available(r.batch_id)).toBe(0);
    await expect(
      asUser(db, MANAGER_A, `select public.reverse_movement($1, $2, 'Outra vez', $3)`, [
        PH_A,
        r.id,
        newKey(),
      ]),
    ).rejects.toThrow(/já foi corrigido/);
    const original = await db.query(`select id from public.stock_movements where id = $1`, [r.id]);
    expect(original.rows).toHaveLength(1);
  });

  it('os movimentos são imutáveis, mesmo para o dono da base de dados', async () => {
    await expect(db.query(`update public.stock_movements set quantity = 1`)).rejects.toThrow(/imutáveis/);
    await expect(db.query(`delete from public.stock_movements`)).rejects.toThrow(/imutáveis/);
  });

  it('a quantidade de um lote nunca pode ficar negativa (constraint)', async () => {
    await expect(db.query(`update public.stock_batches set available_quantity = -1`)).rejects.toThrow(
      /check/,
    );
  });

  it('product_stock calcula estado a partir dos lotes utilizáveis', async () => {
    const rows = await asUser<{ stock_state: string; available_quantity: string; unusable_quantity: string }>(
      db,
      VIEWER_A,
      `select stock_state, available_quantity, unusable_quantity from public.product_stock where id = $1`,
      [PRODUCT_A],
    );
    expect(rows[0]).toBeDefined();
    const total = await db.query<{ q: string }>(
      `select coalesce(sum(available_quantity), 0) as q from public.stock_batches
       where product_id = $1 and status <> 'blocked' and (expiry_date is null or expiry_date >= current_date)`,
      [PRODUCT_A],
    );
    expect(Number(rows[0]?.available_quantity)).toBe(Number(total.rows[0]?.q));
  });
});

describe('contagem física', () => {
  it('mostra diferenças, exige aprovação do gestor e aplica ajustes uma só vez', async () => {
    const product = await db.query<{ id: string }>(
      `insert into public.products (pharmacy_id, name, unit_name) values ($1, 'Produto Contagem', 'un') returning id`,
      [PH_A],
    );
    const productId = product.rows[0]!.id;
    const r = await receive(OPERATOR_A, PH_A, productId, 'CNT1', 10);

    const count = await asUser<{ id: string }>(
      db,
      OPERATOR_A,
      `select * from public.start_stock_count($1, 'Teste')`,
      [PH_A],
    );
    const countId = count[0]!.id;
    await expect(asUser(db, OPERATOR_A, `select public.start_stock_count($1)`, [PH_A])).rejects.toThrow(
      /em curso/,
    );

    const item = await asUser<{ id: string }>(
      db,
      OPERATOR_A,
      `select id from public.stock_count_items where stock_count_id = $1 and batch_id = $2`,
      [countId, r.batch_id],
    );
    const recorded = await asUser<{ difference: string }>(
      db,
      OPERATOR_A,
      `select * from public.record_count_item($1, $2, 7)`,
      [PH_A, item[0]!.id],
    );
    expect(Number(recorded[0]?.difference)).toBe(-3);

    await asUser(db, OPERATOR_A, `select public.submit_stock_count($1, $2)`, [PH_A, countId]);
    await expect(
      asUser(db, OPERATOR_A, `select public.approve_stock_count($1, $2)`, [PH_A, countId]),
    ).rejects.toThrow(/permissão/);
    await asUser(db, MANAGER_A, `select public.approve_stock_count($1, $2)`, [PH_A, countId]);
    await asUser(db, MANAGER_A, `select public.approve_stock_count($1, $2)`, [PH_A, countId]);
    expect(await available(r.batch_id)).toBe(7);

    const adjustments = await db.query(`select id from public.stock_movements where stock_count_id = $1`, [
      countId,
    ]);
    expect(adjustments.rows).toHaveLength(1);
    const status = await db.query<{ status: string; approved_by: string }>(
      `select status, approved_by from public.stock_counts where id = $1`,
      [countId],
    );
    expect(status.rows[0]).toMatchObject({ status: 'completed', approved_by: MANAGER_A });
  });
});

describe('equipa e acessos', () => {
  it('a administradora não se pode despromover e a farmácia mantém uma administradora', async () => {
    const members = await asUser<{ member_id: string; user_id: string }>(
      db,
      OWNER_A,
      `select member_id, user_id from public.list_members($1)`,
      [PH_A],
    );
    const self = members.find((m) => m.user_id === OWNER_A)!;
    await expect(
      asUser(db, OWNER_A, `select public.update_member($1, $2, 'viewer', true)`, [PH_A, self.member_id]),
    ).rejects.toThrow(/próprio/);
  });

  it('um funcionário desactivado perde o acesso imediatamente, mantendo o histórico', async () => {
    const tempUser = 'dddddddd-0000-4000-8000-000000000001';
    await createUser(db, tempUser, 'Temporário');
    const member = await db.query<{ id: string }>(
      `insert into public.pharmacy_members (pharmacy_id, user_id, role) values ($1, $2, 'stock_operator') returning id`,
      [PH_A, tempUser],
    );
    const m = await receive(tempUser, PH_A, PRODUCT_A, 'TEMP1', 2);
    expect(m.id).toBeTruthy();

    await asUser(db, OWNER_A, `select public.update_member($1, $2, null, false)`, [PH_A, member.rows[0]!.id]);

    expect(await asUser(db, tempUser, `select id from public.products`)).toHaveLength(0);
    await expect(receive(tempUser, PH_A, PRODUCT_A, 'TEMP2', 1)).rejects.toThrow(/permissão/);
    const history = await asUser(db, OWNER_A, `select id from public.stock_movements where created_by = $1`, [
      tempUser,
    ]);
    expect(history).toHaveLength(1);
  });

  it('a confirmação de leitura do aviso de privacidade é por utilizador', async () => {
    await asUser(
      db,
      VIEWER_A,
      `insert into public.privacy_acknowledgements (user_id, notice_version) values ($1, '1.0')`,
      [VIEWER_A],
    );
    await expect(
      asUser(
        db,
        VIEWER_A,
        `insert into public.privacy_acknowledgements (user_id, notice_version) values ($1, '1.0')`,
        [OWNER_A],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await asUser(db, OWNER_A, `select id from public.privacy_acknowledgements`)).toHaveLength(0);
  });

  it('alterações ao stock mínimo ficam auditadas', async () => {
    await asUser(db, MANAGER_A, `update public.products set minimum_stock = 9 where id = $1`, [PRODUCT_A]);
    const log = await db.query<{
      metadata: { before: { minimum_stock: number }; after: { minimum_stock: number } };
      actor_user_id: string;
    }>(
      `select metadata, actor_user_id from public.audit_logs
       where entity_id = $1 and action = 'update' order by created_at desc limit 1`,
      [PRODUCT_A],
    );
    expect(log.rows[0]?.actor_user_id).toBe(MANAGER_A);
    expect(Number(log.rows[0]?.metadata.after.minimum_stock)).toBe(9);
  });
});

describe('seed', () => {
  it('o seed fictício aplica-se e respeita o isolamento', async () => {
    const seeded = await createDatabase({ seed: true });
    const a = await asUser(
      seeded,
      'a0000000-0000-4000-8000-000000000003',
      `select distinct pharmacy_id from public.products`,
    );
    expect(a).toEqual([{ pharmacy_id: 'f0000000-0000-4000-8000-00000000000a' }]);
    // As verificações usadas após um restauro passam sobre o seed.
    await seeded.exec(readFileSync('scripts/restore-test/verify.sql', 'utf8'));
    await seeded.close();
  });
});
