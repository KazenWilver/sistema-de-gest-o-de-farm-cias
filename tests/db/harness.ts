import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = join(import.meta.dirname, '..', '..', 'supabase');

/**
 * Imitação mínima do que o Supabase fornece antes das migrações:
 * papéis anon/authenticated/service_role, esquema auth com auth.users,
 * auth.identities e auth.uid() (lido de request.jwt.claim.sub, como no Supabase).
 */
export const SUPABASE_STUB = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists extensions;
  create extension if not exists pgcrypto schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    instance_id uuid,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    last_sign_in_at timestamptz,
    banned_until timestamptz,
    confirmation_token text,
    recovery_token text,
    email_change_token_new text,
    email_change text
  );
  create table auth.identities (
    id uuid primary key,
    user_id uuid references auth.users (id),
    provider_id text,
    provider text,
    identity_data jsonb,
    last_sign_in_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $f$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $f$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Como no Supabase: privilégios por omissão generosos, que as migrações têm de retirar.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  const dir = join(root, 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f));
}

export function readSeed(): string {
  return readFileSync(join(root, 'seed.sql'), 'utf8');
}

export async function createDatabase(options: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(file, 'utf8'));
  }
  if (options.seed) await db.exec(readSeed());
  return db;
}

type Row = Record<string, unknown>;

/** Executa SQL como um utilizador autenticado (RLS activo). userId null = autenticado sem identidade. */
export async function asUser<T extends Row = Row>(
  db: PGlite,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.exec('set role authenticated');
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
    const result = await db.query<T>(sql, params);
    return result.rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function asAnon<T extends Row = Row>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.exec('set role anon');
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

export async function createUser(db: PGlite, id: string, name: string): Promise<void> {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, jsonb_build_object('display_name', $3::text))`,
    [id, `${id.slice(0, 8)}@exemplo.test`, name],
  );
}

let keyCounter = 0;
export function newKey(): string {
  keyCounter += 1;
  return `test-key-${Date.now()}-${keyCounter}`;
}
