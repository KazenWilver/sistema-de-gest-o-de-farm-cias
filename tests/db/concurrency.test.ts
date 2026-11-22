/**
 * Concorrência real: exige um Postgres descartável (não corre em PGlite, que tem uma só ligação).
 * Executar com TEST_DATABASE_URL apontado para um servidor onde o utilizador possa criar bases de dados,
 * por exemplo o Postgres do `supabase start` (postgres://postgres:postgres@127.0.0.1:54322/postgres).
 * O teste cria e apaga uma base de dados própria.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrationFiles, SUPABASE_STUB } from './harness';

const url = process.env.TEST_DATABASE_URL;
const dbName = `farmastock_concurrency_${Date.now()}`;
const PH = '11111111-1111-4111-8111-111111111111';
const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const PRODUCT = '33333333-3333-4333-8333-333333333331';

function targetUrl(): string {
  const u = new URL(url!);
  u.pathname = `/${dbName}`;
  return u.toString();
}

async function asUserClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: targetUrl() });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [USER]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

describe.skipIf(!url)('concorrência em Postgres real', () => {
  let admin: pg.Client;
  let batchId: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const setup = new pg.Client({ connectionString: targetUrl() });
    await setup.connect();
    await setup.query(SUPABASE_STUB);
    for (const f of migrationFiles()) await setup.query(readFileSync(f, 'utf8'));
    await setup.query(`insert into auth.users (id, email) values ($1, 'c@exemplo.test')`, [USER]);
    await setup.query(`insert into public.pharmacies (id, name) values ($1, 'Farmácia C')`, [PH]);
    await setup.query(
      `insert into public.pharmacy_members (pharmacy_id, user_id, role) values ($1, $2, 'owner')`,
      [PH, USER],
    );
    await setup.query(
      `insert into public.products (id, pharmacy_id, name, unit_name) values ($1, $2, 'P', 'un')`,
      [PRODUCT, PH],
    );
    await setup.end();
    const m = await asUserClient((c) =>
      c.query(
        `select batch_id from public.receive_stock($1, $2, 'CONC1', current_date + 100, 5, 'conc-receipt-1')`,
        [PH, PRODUCT],
      ),
    );
    batchId = m.rows[0].batch_id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it('10 saídas simultâneas de 1 unidade num lote com 5: só 5 passam e o stock fica em 0', async () => {
    const attempts = Array.from({ length: 10 }, (_, i) =>
      asUserClient((c) =>
        c.query(`select public.issue_stock($1, $2, 1, 'issue', $3)`, [PH, batchId, `conc-issue-${i}-xxxx`]),
      ),
    );
    const results = await Promise.allSettled(attempts);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const check = new pg.Client({ connectionString: targetUrl() });
    await check.connect();
    const q = await check.query(`select available_quantity from public.stock_batches where id = $1`, [
      batchId,
    ]);
    await check.end();
    expect(Number(q.rows[0].available_quantity)).toBe(0);
  });

  it('pedidos simultâneos com a mesma chave geram um só movimento', async () => {
    await asUserClient((c) =>
      c.query(`select public.adjust_stock($1, $2, 10, 'Reposição para teste', 'conc-adjust-1')`, [
        PH,
        batchId,
      ]),
    );
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        asUserClient((c) =>
          c.query(`select id from public.issue_stock($1, $2, 2, 'issue', 'conc-same-key')`, [PH, batchId]),
        ),
      ),
    );
    const ids = new Set(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.rows[0].id] : [])));
    expect(ids.size).toBe(1);
    const check = new pg.Client({ connectionString: targetUrl() });
    await check.connect();
    const q = await check.query(`select available_quantity from public.stock_batches where id = $1`, [
      batchId,
    ]);
    await check.end();
    expect(Number(q.rows[0].available_quantity)).toBe(8);
  });
});
